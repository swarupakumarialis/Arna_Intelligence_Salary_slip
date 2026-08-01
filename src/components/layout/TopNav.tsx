import React from 'react';
import { Building2, LogOut, User } from 'lucide-react';
import { useCurrency, CurrencyCode, CURRENCY_META, CURRENCY_CODES } from '../../contexts/CurrencyContext';

interface Props {
  logoDataUri: string | null;
  appName: string;
  periodLabel: string;
  onLogout?: () => void;
}

/**
 * Top navigation bar — branding, current payroll period, a global
 * currency switcher, and a generic "HR Admin" chip + logout control.
 * Otherwise purely presentational chrome; no local state. The logo
 * comes from BrandConfig, so a white-labelled deployment updates it
 * here automatically, without any code change.
 *
 * Deliberately does not display the literal login username — the
 * simple-auth credential is a shared operator login, not a personal
 * account, so the chrome shows a role label ("HR Admin") instead.
 *
 * No tagline/subtitle under the product name — logo + name only, per
 * the cleaner, more premium nav treatment.
 */
export function TopNav({ logoDataUri, appName, periodLabel, onLogout }: Props) {
  const { currency, setCurrency } = useCurrency();

  return (
    <header className="app-topnav">
      <div className="app-topnav-brand">
        <div className="app-topnav-logo">
          {logoDataUri ? <img src={logoDataUri} alt={appName} /> : <Building2 size={22} />}
        </div>
        <div className="app-topnav-title" style={{ minWidth: 0 }}>{appName}</div>
      </div>

      <div className="app-topnav-right">
        <span className="app-topnav-period">{periodLabel}</span>
        <select
          className="app-topnav-currency"
          value={currency}
          onChange={e => setCurrency(e.target.value as CurrencyCode)}
          aria-label="Display currency"
          title="Display currency — payroll is always stored in the configured base currency"
        >
          {CURRENCY_CODES.map(c => (
            <option key={c} value={c}>{CURRENCY_META[c].symbol} {c}</option>
          ))}
        </select>
        <div className="app-topnav-user">
          <div className="app-topnav-user-avatar"><User size={13} /></div>
          <span className="app-topnav-user-name">HR Admin</span>
          {onLogout && (
            <button className="app-topnav-logout" onClick={onLogout} title="Log out" aria-label="Log out">
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
