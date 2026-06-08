import { forwardRef, useEffect, useRef, useState } from 'react';
import type { TransparencyMetric, TransparencyLogEntry } from '../types';
import { formatNumber } from '../utils/format';

interface TransparencySectionProps {
  isLoading: boolean;
  metrics: TransparencyMetric[];
  logs: TransparencyLogEntry[];
}

/**
 * Transparency Ledger section – matches Flutter _TransparencySection.
 * Responsive metric card grid (1→2→3 cols) + logs panel.
 */
export const TransparencySection = forwardRef<HTMLElement, TransparencySectionProps>(
  ({ isLoading, metrics, logs }, ref) => {
    return (
      <section ref={ref} id="transparency" aria-labelledby="transparency-title">
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span aria-hidden style={{ fontSize: 34, color: '#147A68', lineHeight: 1 }}>
            <VerifiedIcon />
          </span>
          <h2
            id="transparency-title"
            style={{ color: '#14231E', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 900, margin: 0 }}
          >
            Public Transparency Ledger
          </h2>
        </div>

        <p
          style={{
            color: '#60736B', fontSize: 17, lineHeight: 1.6,
            margin: '0 0 28px', maxWidth: 740,
          }}
        >
          Each eco-action is verified, timestamped, and chained into a tamper-resistant activity stream
          so the community can trust what gets rewarded.
        </p>

        {/* Metric cards grid */}
        <MetricGrid metrics={metrics} />

        <div style={{ height: 28 }} />

        {/* Logs panel */}
        <LogsPanel isLoading={isLoading} logs={logs} />
      </section>
    );
  }
);

TransparencySection.displayName = 'TransparencySection';

/* ─── Metric Grid ──────────────────────────────────────────── */

function MetricGrid({ metrics }: { metrics: TransparencyMetric[] }) {
  const [cols, setCols] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.offsetWidth ?? window.innerWidth;
      setCols(w >= 1100 ? 3 : w >= 720 ? 2 : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 18,
      }}
    >
      {metrics.map((m) => (
        <MetricCard key={m.label} metric={m} />
      ))}
    </div>
  );
}

function MetricCard({ metric }: { metric: TransparencyMetric }) {
  return (
    <article
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: 22,
        background: 'rgba(255,255,255,0.88)',
        borderRadius: 26,
        border: '1px solid #D6E5DC',
        boxShadow: '0 14px 24px rgba(13,64,56,0.07)',
      }}
    >
      {/* Icon badge */}
      <div
        style={{
          width: 60, height: 60, borderRadius: 20, flexShrink: 0,
          background: `${metric.accent}1E`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <MetricIcon type={metric.icon} color={metric.accent} />
      </div>

      <div>
        <p style={{ color: '#60736B', fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
          {metric.label}
        </p>
        <p style={{ color: '#14231E', fontSize: 30, fontWeight: 900, margin: 0, lineHeight: 1 }}>
          {formatNumber(metric.value)}{metric.suffix ?? ''}
        </p>
      </div>
    </article>
  );
}

function MetricIcon({ type, color }: { type: TransparencyMetric['icon']; color: string }) {
  const s: React.CSSProperties = { width: 28, height: 28, color };
  if (type === 'eco') {
    return (
      <svg style={s} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm-1 14H9V8h2v9zm4 0h-2V8h2v9z"/>
      </svg>
    );
  }
  if (type === 'trophy') {
    return (
      <svg style={s} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H9v2h6v-2h-2v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
      </svg>
    );
  }
  // groups
  return (
    <svg style={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 13c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm6.08-9.95c1.07 1.22 1.72 2.83 1.72 4.59 0 1.72-.62 3.3-1.65 4.51.49.07.99.13 1.5.16 2.46-.3 4.35-2.38 4.35-4.88 0-2.67-2.16-4.83-4.83-4.83-.79 0-1.53.2-2.19.55.41.57.75 1.19 1.1 1.9z"/>
    </svg>
  );
}

/* ─── Logs Panel ───────────────────────────────────────────── */

function LogsPanel({ isLoading, logs }: { isLoading: boolean; logs: TransparencyLogEntry[] }) {
  const [wide, setWide] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const w = ref.current?.offsetWidth ?? window.innerWidth;
      setWide(w >= 920);
    };
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="glass-card"
      style={{ padding: 24, width: '100%' }}
    >
      <h3 style={{ color: '#14231E', fontSize: 22, fontWeight: 900, margin: '0 0 8px' }}>
        Latest Immutable Actions
      </h3>
      <p style={{ color: '#60736B', lineHeight: 1.6, margin: '0 0 22px' }}>
        Every entry includes an anonymized contributor, a rewarded action, and its linked SHA-256 record.
      </p>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
          <LoadingSpinner />
        </div>
      ) : wide ? (
        <LogTable logs={logs} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  color: '#6B7280',
  fontWeight: 800,
  fontSize: 13,
};

function LogTable({ logs }: { logs: TransparencyLogEntry[] }) {
  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <div style={{ flex: 3, ...headerStyle }}>User (Anonymized)</div>
        <div style={{ flex: 4, ...headerStyle }}>Action</div>
        <div style={{ flex: 2, ...headerStyle }}>Points</div>
        <div style={{ flex: 5, ...headerStyle }}>SHA-256 Hash Link</div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '0 0 4px' }} />

      {logs.map((log) => (
        <div
          key={log.id}
          style={{ display: 'flex', gap: 16, padding: '14px 0', alignItems: 'flex-start' }}
        >
          <div style={{ flex: 3, color: '#111827', fontWeight: 700 }}>{log.user}</div>
          <div style={{ flex: 4, color: '#4B5563' }}>{log.action}</div>
          <div style={{ flex: 2, color: '#2E7D32', fontWeight: 900 }}>+{log.points}</div>
          <div
            style={{ flex: 5, color: '#9CA3AF', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={log.hash}
          >
            {log.hash}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogCard({ log }: { log: TransparencyLogEntry }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 22,
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 900, color: '#111827' }}>{log.user}</span>
        <span style={{ color: '#2E7D32', fontWeight: 900 }}>+{log.points} pts</span>
      </div>
      <p style={{ color: '#4B5563', lineHeight: 1.5, margin: '0 0 14px' }}>{log.action}</p>
      <p style={{ color: '#6B7280', fontWeight: 700, fontSize: 13, margin: '0 0 6px' }}>SHA-256 Hash</p>
      <p
        style={{
          color: '#9CA3AF', fontFamily: 'monospace',
          lineHeight: 1.5, margin: 0,
          wordBreak: 'break-all',
        }}
      >
        {log.hash}
      </p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid #D6E5DC',
        borderTopColor: '#147A68',
        animation: 'spin-slow 0.9s linear infinite',
      }}
    />
  );
}

/* ─── Icon helper ─────────────────────────────────────────── */
function VerifiedIcon() {
  return (
    <svg style={{ width: 34, height: 34, color: '#147A68', display: 'block' }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.47 1.89-3.2 3.61-.82-.34-3.69L23 12zm-13 5l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
  );
}
