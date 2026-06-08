import logo from '../assets/logo.png';

interface ActionOverlayProps {
  message: string;
}

/**
 * Semi-transparent action overlay – matches Flutter _SectionActionOverlay.
 * Shown over the page while a scroll/action is in progress.
 */
export function ActionOverlay({ message }: ActionOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(13,64,56,0.42)' }}
      aria-live="polite"
    >
      <div
        style={{
          width: 280,
          padding: '24px 22px',
          background: '#0E342E',
          borderRadius: 26,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 16px 30px rgba(0,0,0,0.20)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            style={{
              width: 42, height: 42,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img src={logo} alt="" aria-hidden style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '0.06em' }}>
            ECOBUD
          </span>
        </div>

        {/* Message */}
        <p
          className="text-center mb-5"
          style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.4 }}
        >
          {message}
        </p>

        {/* Mini spinner */}
        <MiniLoader />
      </div>
    </div>
  );
}

function MiniLoader() {
  const size = 58;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg
        style={{ position: 'absolute', inset: 0, animation: 'spin-slow 1.4s linear infinite' }}
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      >
        <circle cx={size/2} cy={size/2} r={size/2-4} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4.2} />
        <circle
          cx={size/2} cy={size/2} r={size/2-4} fill="none"
          stroke="#D8FFE8" strokeWidth={4.2} strokeLinecap="round"
          strokeDasharray={`${(size/2-4)*2*Math.PI}`}
          strokeDashoffset={`${(size/2-4)*2*Math.PI*0.72}`}
          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', top:'50%', left:'50%',
          transform: 'translate(-50%,-50%)',
          width: size*0.58, height: size*0.58, borderRadius: '50%',
          background: '#154F46', border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <img src="/logo.png" alt="" aria-hidden style={{ width: 20, height: 20, objectFit: 'contain' }} />
      </div>
    </div>
  );
}
