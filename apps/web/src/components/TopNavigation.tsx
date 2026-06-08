import logo from '../assets/logo.png';

interface TopNavigationProps {
  onHomeTap: () => void;
  onTransparencyTap: () => void;
  onAdminTap: () => void;
  onDownloadTap: () => void;
}

/**
 * Glassmorphism top navigation bar.
 * Responsive: stacked on mobile (<860px), single row on desktop.
 * Matches Flutter _TopNavigation.
 */
export function TopNavigation({
  onHomeTap,
  onTransparencyTap,
  onAdminTap,
  onDownloadTap,
}: TopNavigationProps) {
  return (
    <header
      id="top-nav"
      style={{
        width: '100%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(241,250,244,0.92) 50%, rgba(233,248,241,0.86) 100%)',
        borderBottom: '1px solid rgba(214,229,220,0.4)',
        boxShadow: '0 14px 30px rgba(13,64,56,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '18px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Brand wordmark */}
        <EcobudWordmark />

        {/* Nav links */}
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}
          aria-label="Main navigation"
        >
          <button id="nav-home" className="btn-nav" onClick={onHomeTap}>
            Home
          </button>
          <button id="nav-transparency" className="btn-nav" onClick={onTransparencyTap}>
            Transparency
          </button>
          <button id="nav-admin" className="btn-nav hidden md:inline-flex" onClick={onAdminTap}>
            Admin
          </button>
          <button id="nav-download" className="btn-gradient" onClick={onDownloadTap} style={{ padding: '10px 22px' }}>
            Download App
          </button>
        </nav>
      </div>
    </header>
  );
}

/** EcoBud logo + text wordmark */
function EcobudWordmark({ large = false, light = false }: { large?: boolean; light?: boolean }) {
  const badgeSize = large ? 58 : 42;
  const iconSize = large ? 30 : 22;
  const textSize = large ? 34 : 24;
  const gap = large ? 14 : 10;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      <div
        style={{
          width: badgeSize, height: badgeSize,
          borderRadius: '50%',
          background: light ? 'rgba(255,255,255,0.14)' : '#fff',
          border: `1px solid ${light ? 'rgba(255,255,255,0.18)' : '#D6E5DC'}`,
          boxShadow: light ? 'none' : '0 8px 14px rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <img src={logo} alt="EcoBud" style={{ width: iconSize, height: iconSize, objectFit: 'contain' }} />
      </div>
      <span
        style={{
          color: light ? '#fff' : '#14231E',
          fontSize: textSize,
          fontWeight: 900,
          letterSpacing: large ? '0.055em' : '0.04em',
        }}
      >
        ECOBUD
      </span>
    </div>
  );
}

export { EcobudWordmark };
