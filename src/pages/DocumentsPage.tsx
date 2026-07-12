import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { ComingSoonGrid } from '../components/ui/ComingSoonGrid';
import {
  Receipt, FileBadge, FileSignature, FileText,
  ScrollText, Users, Building2, BookOpen,
} from 'lucide-react';

const DOCUMENT_ITEMS = [
  { icon: Receipt, label: 'Salary Slips', desc: 'Every generated payslip, in one searchable archive.' },
  { icon: FileBadge, label: 'Form 16', desc: 'Annual tax certificates, generated per employee.' },
  { icon: FileSignature, label: 'Appointment Letters', desc: 'Standardised appointment letter templates.' },
  { icon: FileText, label: 'Offer Letters', desc: 'Branded offer letter generation and tracking.' },
  { icon: ScrollText, label: 'HR Policies', desc: 'Company policy documents, versioned and published.' },
  { icon: Users, label: 'Employee Documents', desc: 'ID proofs, contracts, and other employee files.' },
  { icon: Building2, label: 'Company Documents', desc: 'Registrations, licenses, and compliance records.' },
  { icon: BookOpen, label: 'User Guides', desc: 'How-to guides for using the ARNA Salary Suite.' },
];

/** UI-only "Documents" destination (Sprint 5.7) — no backend, no
    storage, no API calls. Every card below is a placeholder for a
    future document-management module; nothing here reads or writes
    real data. */
export function DocumentsPage() {
  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Documents"
        description="A central home for salary slips, letters, policies, and company records — coming soon."
      />
      <ComingSoonGrid items={DOCUMENT_ITEMS} />
    </div>
  );
}
