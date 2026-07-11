import React from 'react';
import { Search } from 'lucide-react';

/** Row container for a page's search box + filter dropdowns + sort button. */
export function TableToolbar({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>{children}</div>;
}

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  flex?: string;
}

export function SearchInput({ value, onChange, placeholder, flex = '1 1 220px' }: SearchInputProps) {
  return (
    <div style={{ position: 'relative', flex }}>
      <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-subtle)' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="field"
        style={{ paddingLeft: 32 }}
        aria-label={placeholder}
      />
    </div>
  );
}
