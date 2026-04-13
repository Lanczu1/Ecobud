import React from 'react';

interface PresenceIndicatorProps {
  isOnline: boolean;
  label: string;
  compact?: boolean;
  className?: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  isOnline,
  label,
  compact = false,
  className = '',
}) => {
  const paletteClasses = isOnline
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';

  const sizeClasses = compact
    ? 'px-2.5 py-1 text-[10px] font-black uppercase tracking-wider'
    : 'px-3 py-1.5 text-[11px] font-black uppercase tracking-wider';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border ${paletteClasses} ${sizeClasses} ${className}`.trim()}
    >
      <span
        className={`presence-dot ${isOnline ? 'presence-dot-online' : 'presence-dot-offline'}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
};
