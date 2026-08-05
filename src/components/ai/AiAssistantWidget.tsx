import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, User, Loader2, X } from 'lucide-react';
import { askAiAssistant, AiAssistantContext, AiAssistantTurn, ApiError } from '../../api/aiApi';
import { loadCompanySettings } from '../../utils/companySettingsStore';
import { loadInvoiceSettings } from '../../modules/finance/utils/invoiceSettingsStore';
import type { SidebarKey } from '../layout/Sidebar';

/** Default suggestion chips — shown on every page that isn't the
    Employee Directory or Invoice History (Sprint 10, requirement 10). */
const DEFAULT_SUGGESTIONS = [
  'How many employees are active?',
  'Who joined this month?',
  'Invoice summary',
  'Total payroll this month.',
  'System health',
  'Is Google Drive connected?',
];

/** Employee Directory-specific suggestions — swapped in when
    `activePage === 'directory'` so the chips match what someone
    looking at that screen is actually likely to ask. */
const DIRECTORY_SUGGESTIONS = [
  "Who's active?",
  'Joined this month?',
  'Interns?',
  'Recent employees?',
];

/** Invoice History-specific suggestions — swapped in when
    `activePage === 'invoice-history'`. */
const INVOICE_SUGGESTIONS = [
  'Outstanding invoices',
  'Paid invoices',
  'Recent invoices',
  'Invoice summary',
];

function suggestionsFor(activePage?: SidebarKey): string[] {
  if (activePage === 'directory') return DIRECTORY_SUGGESTIONS;
  if (activePage === 'invoice-history') return INVOICE_SUGGESTIONS;
  return DEFAULT_SUGGESTIONS;
}

const ASSISTANT_NAME = 'Arna Intelligence IntelliPayRoll AI Assistant';

/** Server-side (RuleBasedProvider.js) has the identical function for
    the GREETING intent's reply — this is the client-side equivalent
    used only for the very first message shown before any question has
    been asked (i.e. before there's anything to send to the backend). */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function buildWelcomeMessage(): string {
  return `${timeOfDayGreeting()}! I'm the ${ASSISTANT_NAME}. I can help with employees, payroll, invoices, or company settings — I'm read-only in this version, so I can look things up but can't make any changes. Try one of the suggestions below to get started.`;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/* ── Sprint 9: lightweight session-only conversation memory ─────────
   Both the message transcript and the last structured turn (used to
   resolve "name them"/"show all" follow-ups — see aiApi.ts's
   AiAssistantTurn) live in sessionStorage only: cleared when the tab
   closes, never sent anywhere but this browser, and never written to
   MongoDB. This is what "requirement 7 — session state only" means in
   practice; the backend itself is stateless per request (see
   ai.service.js), so this client-side echo is the entire mechanism. */
const MESSAGES_KEY = 'arna_ai_widget_messages_v1';
const LAST_TURN_KEY = 'arna_ai_widget_last_turn_v1';

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed as ChatMessage[];
    }
  } catch { /* ignore — falls through to the welcome message */ }
  return [{ role: 'assistant', content: buildWelcomeMessage() }];
}

function loadStoredLastTurn(): AiAssistantTurn | undefined {
  try {
    const raw = sessionStorage.getItem(LAST_TURN_KEY);
    if (raw) return JSON.parse(raw) as AiAssistantTurn;
  } catch { /* ignore */ }
  return undefined;
}

/** Renders the small formatted-text subset RuleBasedProvider's
    responses use (backend/src/services/ai/providers/RuleBasedProvider.js):
    lines starting with "- " become a bullet list, "**bold**" spans
    become <strong>, blank lines become spacing. No markdown library —
    the backend only ever emits this fixed subset, so a full parser
    would be solving a problem that doesn't exist here. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (!listBuffer.length) return;
    blocks.push(
      <ul key={key} style={{ margin: '2px 0 6px', paddingLeft: 18 }}>
        {listBuffer.map((item, i) => <li key={i} style={{ marginBottom: 2, lineHeight: 1.5 }}>{renderInline(item)}</li>)}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
      return;
    }
    flushList(`ul-${idx}`);
    if (line.trim() === '') {
      blocks.push(<div key={`sp-${idx}`} style={{ height: 4 }} />);
    } else {
      blocks.push(<p key={`p-${idx}`} style={{ margin: '2px 0', lineHeight: 1.5 }}>{renderInline(line)}</p>);
    }
  });
  flushList('ul-end');

  return <>{blocks}</>;
}

/**
 * Global floating AI Assistant (Sprint 9) — a fixed bottom-right button
 * that opens a chat drawer, available on every page. Mounted exactly
 * once at the App shell root (see App.tsx), sibling to the
 * activePage-conditional page content rather than one of its branches
 * — that's what makes it survive sidebar navigation: it simply never
 * unmounts when `activePage` changes, so its own React state (open/
 * closed, messages, conversation context) carries straight through.
 *
 * Talks to the backend exclusively through POST /api/ai/ask (see
 * src/api/aiApi.ts); this component holds no business logic of its
 * own beyond the conversation-memory bookkeeping above — it only
 * renders whatever `message` the backend's ai.service.js/AIProvider
 * produced, and echoes back the last turn's {intent, entities} so the
 * backend can resolve a follow-up question against it.
 */
interface Props {
  /** Current sidebar page (see App.tsx) — used only to pick which
      suggestion chips to show (requirement 10); the widget's own
      behavior is otherwise identical regardless of what page it's on. */
  activePage?: SidebarKey;
}

export function AiAssistantWidget({ activePage }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const lastTurnRef = useRef<AiAssistantTurn | undefined>(loadStoredLastTurn());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /** Company/Invoice Settings live in localStorage, not MongoDB (see
      aiApi.ts's AiAssistantContext) — read fresh on every question so
      an edit made in Company/Invoice Settings during this session is
      reflected immediately. */
  function buildContext(): AiAssistantContext {
    const brand = loadCompanySettings();
    const invoiceSettings = loadInvoiceSettings();
    return {
      companyName: brand.companyName,
      defaultCurrency: brand.defaultCurrency,
      baseCurrency: brand.baseCurrency,
      invoicePrefix: invoiceSettings.invoicePrefix,
      defaultTaxPercent: invoiceSettings.defaultTaxPercent,
    };
  }

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const response = await askAiAssistant(trimmed, buildContext(), lastTurnRef.current);
      lastTurnRef.current = { intent: response.intent, entities: response.entities };
      try { sessionStorage.setItem(LAST_TURN_KEY, JSON.stringify(lastTurnRef.current)); } catch { /* ignore */ }
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong reaching the AI Assistant. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="ai-widget-fab"
        onClick={() => setOpen(v => !v)}
        title={open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME}`}
        aria-label={open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME}`}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      {open && (
        <div className="ai-widget-panel" role="dialog" aria-label={ASSISTANT_NAME}>
          <div className="ai-widget-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: '#fff', lineHeight: 1.25, minWidth: 0 }}>
              <Bot size={17} className="ai-widget-header-icon" style={{ flexShrink: 0 }} /> {ASSISTANT_NAME}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                width: 26, height: 26, borderRadius: 6, border: 'none', flexShrink: 0,
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: m.role === 'user' ? 'var(--brand-primary)' : 'var(--clr-bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--brand-primary)',
                  border: m.role === 'assistant' ? '1px solid var(--clr-border)' : 'none',
                }}>
                  {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                </div>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
                  background: m.role === 'user' ? 'var(--brand-primary)' : 'var(--clr-bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--clr-text)',
                  fontSize: 12.5, border: m.role === 'assistant' ? '1px solid var(--clr-border)' : 'none',
                }}>
                  {m.role === 'assistant' ? <FormattedMessage text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--clr-bg)', border: '1px solid var(--clr-border)', color: 'var(--brand-primary)',
                }}>
                  <Bot size={12} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--clr-text-muted)' }}>
                  <Loader2 size={12} className="animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--clr-border)', padding: '10px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {suggestionsFor(activePage).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={sending}
                  style={{
                    flexShrink: 0, whiteSpace: 'nowrap', padding: '5px 10px', borderRadius: 999,
                    border: '1px solid var(--clr-border)', background: 'var(--clr-surface)',
                    color: 'var(--clr-text-muted)', fontSize: 11, fontWeight: 600,
                    cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.5 : 1,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 6 }}>
              <input
                ref={inputRef}
                type="text"
                className="field"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a question…"
                disabled={sending}
                style={{ flex: 1, fontSize: 12.5 }}
              />
              <button
                type="submit"
                className="btn btn-dark"
                disabled={sending || !input.trim()}
                style={{ fontSize: 12, opacity: sending || !input.trim() ? 0.6 : 1 }}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
