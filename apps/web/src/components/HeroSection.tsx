import { forwardRef } from 'react';

interface HeroSectionProps {
  onStartTap: () => void;
  onSecondaryTap: () => void;
}

/**
 * Hero section – matches Flutter _HeroSection.
 * Features gradient card, headline copy, CTA buttons, and the dark "Verified Eco Impact" spotlight card.
 * Responsive: stacked on <960px, side-by-side on wider viewports.
 */
export const HeroSection = forwardRef<HTMLElement, HeroSectionProps>(
  ({ onStartTap, onSecondaryTap }, ref) => {
    return (
      <section
        ref={ref}
        id="hero"
        style={{
          width: '100%',
          padding: 40,
          borderRadius: 40,
          background: 'linear-gradient(135deg, #F9FEFB 0%, #EAF6EF 55%, #DFF1E7 100%)',
          border: '1px solid rgba(255,255,255,0.78)',
          boxShadow: '0 24px 46px rgba(13,64,56,0.09)',
          position: 'relative',
          overflow: 'hidden',
        }}
        aria-labelledby="hero-title"
      >
        {/* Decorative orbs inside the card */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: -38, right: -20,
            width: 190, height: 190, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(199,241,222,0.34) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute', bottom: -82, left: -60,
            width: 250, height: 250, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(215,238,227,0.27) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          {/* Left: copy */}
          <div style={{ flex: '6 1 280px', minWidth: 0 }}>
            {/* Badge */}
            <div
              style={{
                display: 'inline-block',
                padding: '8px 14px',
                borderRadius: 999,
                background: 'rgba(20,122,104,0.10)',
                color: '#147A68',
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 28,
              }}
            >
              Verified eco-action tracking for real-world impact
            </div>

            {/* Title */}
            <h1
              id="hero-title"
              style={{
                color: '#14231E',
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 900,
                lineHeight: 1.05,
                margin: '0 0 22px',
              }}
            >
              Learn, Act, and&nbsp;Earn Rewards
            </h1>

            {/* Description */}
            <p
              style={{
                color: '#60736B',
                fontSize: 18,
                lineHeight: 1.6,
                margin: '0 0 28px',
                maxWidth: 560,
              }}
            >
              Discover sustainable habits, join challenges, and track your environmental impact with ECOBUD.
              Our blockchain-inspired ledger keeps every reward traceable and every action trustworthy.
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button id="hero-start-cta" className="btn-gradient" onClick={onStartTap}>
                Start Your Eco Journey
              </button>
              <button id="hero-transparency-cta" className="btn-outline" onClick={onSecondaryTap}>
                View Transparency
              </button>
            </div>
          </div>

          {/* Right: spotlight card */}
          <div style={{ flex: '5 1 260px', minWidth: 0 }}>
            <SpotlightCard />
          </div>
        </div>
      </section>
    );
  }
);

HeroSection.displayName = 'HeroSection';

/** Dark "Verified Eco Impact" spotlight card */
function SpotlightCard() {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 28,
        background: 'linear-gradient(135deg, #103C35 0%, #116457 50%, #17876E 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ShieldCheckIcon />
        </div>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Verified Eco Impact</span>
      </div>

      <SpotlightRow
        icon={<HubIcon />}
        title="Immutable action chain"
        subtitle="Each entry links to the previous SHA-256 record."
      />
      <div style={{ height: 18 }} />
      <SpotlightRow
        icon={<GiftIcon />}
        title="Transparent rewards"
        subtitle="Points and achievements stay easy to audit."
      />
      <div style={{ height: 18 }} />
      <SpotlightRow
        icon={<GroupsIcon />}
        title="Community-ready"
        subtitle="Daily challenges, events, and shared progress."
      />
    </div>
  );
}

interface SpotlightRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function SpotlightRow({ icon, title, subtitle }: SpotlightRowProps) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        style={{
          padding: 10, borderRadius: 16,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: '0 0 4px' }}>{title}</p>
        <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, margin: 0, fontSize: 14 }}>{subtitle}</p>
      </div>
    </div>
  );
}

/* ── Inline SVG icons (no dependency needed) ── */
const iconStyle: React.CSSProperties = { width: 22, height: 22, color: '#fff' };

function ShieldCheckIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.25C17.25 21.15 21 16.25 21 11V5L12 1zm-1 14l-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6z"/>
    </svg>
  );
}

function HubIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-2.18c.07-.32.18-.62.18-.96C18 3.36 16.64 2 15.04 2c-.93 0-1.72.47-2.23 1.2L12 4.38l-.81-1.18C10.68 2.47 9.89 2 8.96 2 7.36 2 6 3.36 6 4.96c0 .34.11.64.18.96H4c-1.1 0-2 .9-2 2v3c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V8c0-1.1-.9-2-2-2zm-5-.96C14.96 5.36 14.02 6 13 6h-1V5c.39-.76 1.08-1.32 1.96-1 .59.21 1.04.74 1.04 1.04zm-5.96-.08C9.04 4.72 9.98 5.36 11 5.36L11 6h-1c-1.02 0-1.96-.64-2-1.96-.04-.3.41-.83 1-.83zM3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7H3v7z"/>
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 13c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm6.08-9.95c1.07 1.22 1.72 2.83 1.72 4.59 0 1.72-.62 3.3-1.65 4.51.49.07.99.13 1.5.16 2.46-.3 4.35-2.38 4.35-4.88 0-2.67-2.16-4.83-4.83-4.83-.79 0-1.53.2-2.19.55.41.57.75 1.19 1.1 1.9zM5.85 9.64C5.85 7.14 7.74 5.06 10.2 4.76c-.66-.35-1.4-.55-2.19-.55C5.34 4.21 3.18 6.37 3.18 9.04c0 2.5 1.89 4.58 4.35 4.88.51-.03 1.01-.09 1.5-.16-1.03-1.21-1.65-2.79-1.65-4.51 0-.49.05-.97.15-1.44-.49-.07-.98-.17-1.48-.17z"/>
    </svg>
  );
}
