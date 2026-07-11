import React from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  /** Real "Month Year" label from utils/date.ts's getCurrentPeriodLabel() — always the actual current date, never stored or hardcoded. */
  periodLabel: string;
}

/** Dashboard hero strip. Static, role-based copy rather than the
    literal login username — the simple-auth credential is a shared
    operator login, not a personal account (see TopNav's "HR Admin"
    chip for the same reasoning). */
export function WelcomeBanner({ periodLabel }: Props) {
  return (
    <div className="welcome-banner">
      <div>
        <div className="welcome-banner-eyebrow"><Sparkles size={12} /> {periodLabel}</div>
        <h1 className="welcome-banner-title">Payroll Dashboard</h1>
        <p className="welcome-banner-sub">Welcome back, Administrator</p>
        <p className="welcome-banner-sub">Here's your payroll overview for this month.</p>
      </div>
    </div>
  );
}
