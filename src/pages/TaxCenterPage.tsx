import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { ComingSoonGrid } from '../components/ui/ComingSoonGrid';
import {
  TrendingUp, FileCheck2, FileSignature, Calculator, FileBadge, History,
} from 'lucide-react';

const TAX_CENTER_ITEMS = [
  { icon: TrendingUp, label: 'Income Tax Forecast', desc: 'Projected annual tax liability per employee.' },
  { icon: FileCheck2, label: 'Proof of Investment (POI)', desc: 'Collect and verify investment declarations.' },
  { icon: FileSignature, label: 'Tax Declaration', desc: 'Employee-submitted tax regime and declarations.' },
  { icon: Calculator, label: 'Tax Calculator', desc: 'Old vs. new regime comparison, per employee.' },
  { icon: FileBadge, label: 'Form 16', desc: 'Generate and distribute annual Form 16 certificates.' },
  { icon: History, label: 'Previous Year Tax Summary', desc: 'Historical tax computation records.' },
];

/** UI-only "Tax Center" destination (Sprint 5.7) — no backend
    implementation. Every card below is a roadmap placeholder for
    future tax-management features; nothing here calculates or stores
    real tax data. */
export function TaxCenterPage() {
  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Tax Center"
        description="Income tax forecasting, declarations, and Form 16 — coming soon."
      />
      <ComingSoonGrid items={TAX_CENTER_ITEMS} />
    </div>
  );
}
