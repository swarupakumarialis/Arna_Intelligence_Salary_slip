import React from 'react';
import footerLogo from '../../assets/footer_logo.png';

/**
 * Adapted from a Footer component written for a different project (a
 * Tailwind + react-router-dom + shadcn/ui marketing site). This app has
 * neither Tailwind nor a router, so the adaptation is purely mechanical:
 * react-router-dom's <Link> becomes a plain <a>, Tailwind utility
 * classes become inline styles using this app's existing CSS custom
 * properties (var(--arna-navy) etc.), and the @/assets alias import
 * becomes a relative import of the same footer_logo.png asset, which
 * already existed in src/assets/. The link targets, copy, and layout
 * are otherwise unchanged from what was provided.
 */

interface FooterLink {
  name: string;
  href: string | null;
  newTab?: boolean;
  comingSoon?: boolean;
}

const footerLinks: { services: FooterLink[]; company: FooterLink[]; products: FooterLink[] } = {
  services: [
    { name: 'Learning Intelligence (LIaaS)', href: '/services/learning-intelligence' },
    { name: 'LearnTech (LTaaS)', href: '/services/learntech-ai' },
    { name: 'Design (DaaS)', href: '/services/experience-design' },
  ],
  company: [
    { name: 'Framework', href: '/intelligence-engine' },
    { name: 'Insights', href: '/insights' },
    { name: 'Contact', href: '/contact' },
  ],
  products: [
    { name: 'Globiculum', href: '/globiculum-preview', newTab: true },
    { name: 'AI Learning Assistants', href: 'https://discover-design-map.lovable.app/' },
    { name: 'Workflow Engines & Dashboards', href: null, comingSoon: true },
  ],
};

const columnTitleStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: 10, color: '#fff',
};

const linkStyle: React.CSSProperties = {
  fontSize: 13, color: '#fff', textDecoration: 'none', transition: 'color 150ms',
};

function FooterLinkList({ links }: { links: FooterLink[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {links.map(link => (
        <li key={link.name}>
          {link.href ? (
            <a
              href={link.href}
              {...(link.newTab || link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={linkStyle}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--arna-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#fff'; }}
            >
              {link.name}
            </a>
          ) : (
            <div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'block' }}>{link.name}</span>
              <span style={{ fontSize: 13, color: 'var(--arna-amber)' }}>Coming Soon</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** App-wide footer — company branding, service/product/company links,
    and registered address, matching the ARNA Intelligence corporate
    footer design. Rendered once at the bottom of the scrollable
    content area (see App.tsx), so it appears under every page. */
export function Footer() {
  return (
    <footer style={{ background: 'var(--arna-navy)', color: '#fff' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '31px 32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 280px) repeat(3, minmax(0, 200px)) minmax(0, 260px)',
          justifyContent: 'space-between',
          rowGap: 25, columnGap: 24,
        }}
        className="footer-grid"
        >
          {/* Brand */}
          <div style={{ maxWidth: 280, minWidth: 0 }}>
            <a href="/" style={{ display: 'inline-block' }}>
              <img src={footerLogo} alt="Arna Intelligence" style={{ height: 63, width: 'auto', maxWidth: 280, objectFit: 'contain' }} />
            </a>
            <p style={{ marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.35, maxWidth: 260 }}>
              Grounded in learning science. Accelerated by AI systems. Humanized through experience design. Creating
              connected learning ecosystems that deliver measurable business outcomes.
            </p>
            <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--arna-accent)' }}>
              Where Learning Meets Intelligence.
            </p>
          </div>

          {/* Services */}
          <div>
            <h3 style={columnTitleStyle}>Services</h3>
            <FooterLinkList links={footerLinks.services} />
          </div>

          {/* Products */}
          <div>
            <h3 style={columnTitleStyle}>Products</h3>
            <FooterLinkList links={footerLinks.products} />
          </div>

          {/* Company */}
          <div>
            <h3 style={columnTitleStyle}>Company</h3>
            <FooterLinkList links={footerLinks.company} />
          </div>

          {/* Address */}
          <div style={{ minWidth: 0 }}>
            <h3 style={columnTitleStyle}>Address</h3>
            <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.3 }}>
              <p style={{ margin: 0 }}>Plot No: 802 &amp; 803,</p>
              <p style={{ margin: 0 }}>Ayyappa Society,</p>
              <p style={{ margin: 0 }}>Madhapur,</p>
              <p style={{ margin: 0 }}>Hyderabad – 500081</p>
            </div>
            <a
              href="mailto:info_arnaintelligence@alis-global.com"
              style={{ ...linkStyle, display: 'block', marginTop: 7, wordBreak: 'break-word' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--arna-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#fff'; }}
            >
              info_arnaintelligence@alis-global.com
            </a>
          </div>
        </div>

        <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', margin: 0 }}>
            &copy; 2026 Arnas Learning Intelligence Studio Pvt. Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
