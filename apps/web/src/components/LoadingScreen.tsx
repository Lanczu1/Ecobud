import logo from '../assets/logo.png';
import logoname from '../assets/logoname.png';

interface LoadingScreenProps {
  message?: string;
  caption?: string;
}

/**
 * Full-screen pine loading splash – matches Flutter _EcobudLoadingScreen.
 * Shows spinning orbital ring, pulsing logo, wordmark, message, and circular loader.
 */
export function LoadingScreen({
  message = 'Preparing your verified eco journey',
  caption = 'Please wait a moment while EcoBud gets ready.',
}: LoadingScreenProps) {
  return (
    <div
      style={{ background: '#0D4038' }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      aria-live="polite"
      aria-label="Loading EcoBud"
    >
      {/* Ambient orbs */}
      <div
        style={{
          position: 'absolute', top: -90, right: -30,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(211,255,233,0.20) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div
        style={{
          position: 'absolute', bottom: -120, left: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.13) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative flex flex-col items-center">

        {/* Pulsing + spinning logo ring */}
        <div className="animate-pulse-scale" style={{ width: 170, height: 170, position: 'relative' }}>
          {/* Spinning orbital ring */}
          <div
            className="animate-spin-slow"
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '1.4px solid rgba(255,255,255,0.18)',
            }}
          >
            {/* Orbital dot */}
            <div
              style={{
                position: 'absolute', top: 10, left: '50%',
                transform: 'translateX(-50%)',
                width: 14, height: 14, borderRadius: '50%',
                background: '#C8FFE7',
                boxShadow: '0 0 18px 6px rgba(200,255,231,0.4)',
              }}
            />
          </div>

          {/* Logo circle */}
          <div
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 126, height: 126,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #1A9D79 0%, #0A2925 100%)',
              boxShadow: '0 18px 38px rgba(23,212,160,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img src={logo} alt="EcoBud logo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
          </div>
        </div>

        {/* Wordmark */}
        <div className="mt-7 flex items-center justify-center gap-4">
          <img src={logo} alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <img src={logoname} alt="Brand Name" style={{ width: 160, height: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Message */}
        <p
          className="mt-3 text-center"
          style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, fontWeight: 600, letterSpacing: '0.015em' }}
        >
          {message}
        </p>
        <p
          className="mt-2 text-center max-w-xs"
          style={{ color: 'rgba(255,255,255,0.60)', fontSize: 13, fontWeight: 500 }}
        >
          {caption}
        </p>

        {/* Circle loader */}
        <div className="mt-6">
          <CircleLoader />
        </div>
      </div>
    </div>
  );
}

/** Small circular progress indicator with EcoBud logo center */
function CircleLoader() {
  const size = 68;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* SVG spinner ring */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          animation: 'spin-slow 1.4s linear infinite',
        }}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={size / 2 - 4}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={4.5}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={size / 2 - 4}
          fill="none"
          stroke="#D8FFE8"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={`${(size / 2 - 4) * 2 * Math.PI}`}
          strokeDashoffset={`${(size / 2 - 4) * 2 * Math.PI * 0.72}`}
          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
        />
      </svg>

      {/* Center logo */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.58, height: size * 0.58,
          borderRadius: '50%',
          background: '#154F46',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 18px rgba(25,212,162,0.19)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          style={{ width: 24, height: 24, objectFit: 'contain' }}
        />
      </div>
    </div>
  );
}
