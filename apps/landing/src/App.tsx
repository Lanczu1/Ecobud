import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Award,
  Leaf,
  Layers,
  ExternalLink,
  QrCode as QrIcon,
  Copy,
  Check,
  Zap,
  Menu,
  X
} from 'lucide-react';
import logoImg from '../../logo/logo.png';

export default function App() {
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Download URL fallback
  const apkDownloadUrl = import.meta.env.VITE_APK_DOWNLOAD_URL || '/downloads/ecobud-beta.apk';
  const appVersion = import.meta.env.VITE_APP_VERSION || 'v1.0.0-beta';
  const feedbackUrl = import.meta.env.VITE_FEEDBACK_URL || 'https://forms.gle/';

  // Absolute URL for QR code scan on phones
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrTargetUrl = apkDownloadUrl.startsWith('http') ? apkDownloadUrl : `${currentOrigin}${apkDownloadUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background ambient lighting */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Top Navigation */}
      <header className="nav-header">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12 }}>
          {/* Brand Wordmark & Mascot */}
          <a
            href="#"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}
            onClick={closeMenu}
          >
            <img
              src={logoImg}
              alt="EcoBud Logo"
              style={{ width: 38, height: 38, objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(16,185,129,0.35))' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '0.04em', color: '#f0fdf4', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
                ECOBUD
              </span>
              <span className="nav-badge-beta">
                BETA TEST
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="nav-desktop-links" aria-label="Desktop Navigation">
            <a href="#install-guide" className="nav-link">
              <Smartphone size={16} />
              <span>Install Guide</span>
            </a>
            <a href="#features" className="nav-link">
              <Zap size={16} />
              <span>What to Test</span>
            </a>
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
            >
              <ExternalLink size={16} />
              <span>Send Feedback</span>
            </a>
          </nav>

          {/* Right Action: Download Button & Mobile Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href={apkDownloadUrl}
              target={apkDownloadUrl.startsWith('http') ? '_blank' : undefined}
              rel={apkDownloadUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
              download={apkDownloadUrl.startsWith('http') ? undefined : 'ecobud-beta.apk'}
              className="btn-primary nav-btn-desktop"
              style={{ padding: '8px 16px', fontSize: '0.9rem', gap: 6, whiteSpace: 'nowrap' }}
            >
              <Download size={16} />
              <span>Download APK</span>
            </a>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="nav-mobile-toggle"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        <div className={`mobile-menu-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#install-guide" className="mobile-nav-link" onClick={closeMenu}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Smartphone size={18} color="#34d399" />
              Installation Guide
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>&rarr;</span>
          </a>

          <a href="#features" className="mobile-nav-link" onClick={closeMenu}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={18} color="#a3e635" />
              What to Test
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>&rarr;</span>
          </a>

          <a
            href={feedbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-nav-link"
            onClick={closeMenu}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ExternalLink size={18} color="#38bdf8" />
              Tester Feedback
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>&rarr;</span>
          </a>

          <div style={{ marginTop: 16 }}>
            <a
              href={apkDownloadUrl}
              target={apkDownloadUrl.startsWith('http') ? '_blank' : undefined}
              rel={apkDownloadUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
              download={apkDownloadUrl.startsWith('http') ? undefined : 'ecobud-beta.apk'}
              className="btn-primary"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 20px', fontSize: '1rem' }}
              onClick={closeMenu}
            >
              <Download size={18} />
              <span>Download APK ({appVersion})</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* HERO SECTION */}
        <section style={{ paddingTop: '60px', paddingBottom: '80px' }}>
          <div className="container">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 48,
                alignItems: 'center'
              }}
            >
              {/* Left Column: Headlines & Call to Actions */}
              <div>
                <div className="badge-eco" style={{ marginBottom: 24 }}>
                  <Sparkles size={16} />
                  <span>Exclusive Early Access Testing</span>
                </div>

                <h1
                  style={{
                    fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
                    fontWeight: 900,
                    lineHeight: 1.12,
                    marginBottom: 20,
                    color: '#ffffff'
                  }}
                >
                  Experience the <br />
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #84cc16 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    Future of Eco Action
                  </span>
                </h1>

                <p
                  style={{
                    fontSize: '1.15rem',
                    lineHeight: 1.7,
                    color: '#94a3b8',
                    marginBottom: 36,
                    maxWidth: 540
                  }}
                >
                  Download the official EcoBud Android build. Test AI waste segregation, participate in community challenges, and track transparent environmental rewards on your phone.
                </p>

                {/* Direct Action Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
                  <a
                    href={apkDownloadUrl}
                    target={apkDownloadUrl.startsWith('http') ? '_blank' : undefined}
                    rel={apkDownloadUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                    download={apkDownloadUrl.startsWith('http') ? undefined : 'ecobud-beta.apk'}
                    className="btn-primary"
                    style={{ padding: '16px 36px', fontSize: '1.1rem' }}
                  >
                    <Download size={22} />
                    <span>Download APK ({appVersion})</span>
                  </a>

                  <a
                    href="#install-guide"
                    className="btn-secondary"
                    style={{ padding: '16px 26px', fontSize: '1rem' }}
                  >
                    <Smartphone size={20} />
                    <span>Installation Guide</span>
                  </a>
                </div>

                {/* Specs pill */}
                <div
                  style={{
                    display: 'inline-flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 16,
                    padding: '10px 18px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.85rem',
                    color: '#cbd5e1'
                  }}
                >
                  <div><strong>Build:</strong> Android ARM64 / Universal</div>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#64748b' }} />
                  <div><strong>OS:</strong> Android 8.0 or higher</div>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#64748b' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }}>
                    <ShieldCheck size={16} /> Verified Safe
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Phone QR Card */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  className="glass-panel"
                  style={{
                    padding: 32,
                    maxWidth: 420,
                    width: '100%',
                    textAlign: 'center',
                    position: 'relative'
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 16,
                      color: '#a7f3d0',
                      fontWeight: 700,
                      fontSize: '0.95rem'
                    }}
                  >
                    <QrIcon size={20} />
                    <span>Scan with Mobile Camera</span>
                  </div>

                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
                    Open your Android camera or QR scanner to download the APK directly to your phone.
                  </p>

                  {/* QR Box */}
                  <div
                    style={{
                      padding: 20,
                      background: '#ffffff',
                      borderRadius: 20,
                      display: 'inline-block',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                      marginBottom: 20
                    }}
                  >
                    <QRCodeSVG
                      value={qrTargetUrl}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  {/* Copy Link Button */}
                  <div>
                    <button
                      onClick={handleCopyLink}
                      className="btn-secondary"
                      style={{ width: '100%', fontSize: '0.9rem', padding: '10px 16px' }}
                    >
                      {copied ? (
                        <>
                          <Check size={16} color="#34d399" />
                          <span style={{ color: '#34d399' }}>Link Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copy Direct Download Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STEP-BY-STEP INSTALLATION GUIDE */}
        <section id="install-guide" style={{ padding: '80px 0', background: 'rgba(6, 26, 21, 0.45)', borderTop: '1px solid rgba(45,106,79,0.25)', borderBottom: '1px solid rgba(45,106,79,0.25)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 56px' }}>
              <div className="badge-eco" style={{ marginBottom: 14 }}>
                <Smartphone size={16} />
                <span>Tester Setup</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.7rem)', fontWeight: 800, color: '#ffffff', marginBottom: 16 }}>
                How to Install the APK on Android
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6 }}>
                Since this is a closed beta testing build, follow these 3 quick steps to install and start testing EcoBud.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 28
              }}
            >
              {/* Step 1 */}
              <div className="glass-panel" style={{ padding: 32, position: 'relative' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(52,211,153,0.3)',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    marginBottom: 20
                  }}
                >
                  1
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: 12 }}>
                  Download the File
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Click the <strong>Download APK</strong> button above or scan the QR code. Your browser (e.g. Chrome) may notify you that the file could be harmful—tap <strong>"Download anyway"</strong>.
                </p>
              </div>

              {/* Step 2 */}
              <div className="glass-panel" style={{ padding: 32, position: 'relative' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'rgba(132,204,22,0.15)',
                    border: '1px solid rgba(132,204,22,0.3)',
                    color: '#a3e635',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    marginBottom: 20
                  }}
                >
                  2
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: 12 }}>
                  Allow Unknown Apps
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  When opening the downloaded file, Android may prompt for permission. Tap <strong>Settings</strong> and enable <strong>"Allow from this source"</strong> for your browser or file manager.
                </p>
              </div>

              {/* Step 3 */}
              <div className="glass-panel" style={{ padding: 32, position: 'relative' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'rgba(56,189,248,0.15)',
                    border: '1px solid rgba(56,189,248,0.3)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    marginBottom: 20
                  }}
                >
                  3
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: 12 }}>
                  Install & Test EcoBud
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Tap <strong>Install</strong>. Once done, open the app, register an account, test the AI scanner, and send us your valuable feedback!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES TESTING FOCUS */}
        <section id="features" style={{ padding: '80px 0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 56px' }}>
              <div className="badge-eco" style={{ marginBottom: 14 }}>
                <Zap size={16} />
                <span>What to Test</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.7rem)', fontWeight: 800, color: '#ffffff', marginBottom: 16 }}>
                Features Ready for Evaluation
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6 }}>
                Please pay special attention to these primary modules during your user testing sessions:
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 28
              }}
            >
              <div className="glass-panel" style={{ padding: 28 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: 20 }}>
                  <Leaf size={24} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                  AI Waste Classification
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Take photos of recyclable, compostable, or non-biodegradable items. Test accuracy and speed of the classification model.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: 28 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(132,204,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3e635', marginBottom: 20 }}>
                  <Award size={24} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                  Challenges & Reward Points
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Join eco-challenges, log proof of action, and ensure rewards and streak calculations update properly.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: 28 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', marginBottom: 20 }}>
                  <Layers size={24} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                  Eco-Map & Drop-off Points
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Navigate interactive map layers to locate waste segregation drop-off hubs and community clean-up locations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEEDBACK CALL TO ACTION */}
        <section style={{ padding: '60px 0 100px' }}>
          <div className="container">
            <div
              className="glass-panel"
              style={{
                padding: '48px 36px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.4) 100%)',
                borderColor: 'rgba(52, 211, 153, 0.4)',
                textAlign: 'center'
              }}
            >
              <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', fontWeight: 800, color: '#ffffff', marginBottom: 16 }}>
                Found a bug or have suggestions?
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 28px' }}>
                Your insights help make EcoBud seamless and impactful. Let the development team know about any issues or enhancements.
              </p>
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ padding: '14px 32px' }}
              >
                <span>Submit Tester Feedback</span>
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(45, 106, 79, 0.3)', padding: '32px 0', background: '#05100d', textAlign: 'center' }}>
        <div className="container">
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            &copy; {new Date().getFullYear()} EcoBud Project. All rights reserved. Beta Testing Distribution.
          </p>
        </div>
      </footer>
    </div>
  );
}
