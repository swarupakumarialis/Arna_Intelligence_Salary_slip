import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
}

interface Props {
  items: BreadcrumbItem[];
}

/** Simple, non-interactive breadcrumb trail. This app has no URL
    router (navigation is plain state — see Sidebar's SidebarKey /
    App.tsx's activePage), so there's nothing for these to link to;
    they're purely an orientation cue for where a page sits in the
    sidebar hierarchy (e.g. "Finance / Invoice Generator"). */
export function Breadcrumb({ items }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10,
      fontSize: 11.5, fontWeight: 600, color: 'var(--clr-text-subtle)',
    }}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.6 }} />}
          <span style={i === items.length - 1 ? { color: 'var(--clr-text-muted)', fontWeight: 700 } : undefined}>
            {item.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
