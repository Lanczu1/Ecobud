/** Decorative radial-gradient orbs – ambient background layer */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Top-left orb */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(189,239,215,0.34) 0%, transparent 70%)',
        }}
      />
      {/* Top-right orb */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          right: -70,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,245,200,0.27) 0%, transparent 70%)',
        }}
      />
      {/* Bottom-left orb */}
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          left: -60,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(184,233,242,0.20) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
