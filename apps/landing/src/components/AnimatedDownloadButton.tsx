import React, { useState } from 'react';
import { Download, Sparkles } from 'lucide-react';

interface AnimatedDownloadButtonProps {
  href: string;
  version: string;
  label?: string;
  isExternal?: boolean;
  size?: 'md' | 'lg';
  liteMode?: boolean;
  className?: string;
}

export const AnimatedDownloadButton: React.FC<AnimatedDownloadButtonProps> = ({
  href,
  version,
  label = 'Download APK',
  isExternal = false,
  size = 'lg',
  liteMode = false,
  className = '',
}) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      download={isExternal ? undefined : 'ecobud-beta.apk'}
      className={`cartoon-3d-btn size-${size} ${isPressed ? 'is-pressed' : ''} ${className}`}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      aria-label={`${label} (${version})`}
    >
      {/* Top 3D Gloss Highlight */}
      <span className="btn-top-shine" aria-hidden="true" />

      {/* Button Content with Playful Icons */}
      <span className="btn-inner-content">
        <span className="btn-icon-bounce-box" aria-hidden="true">
          <Download size={size === 'lg' ? 22 : 18} />
        </span>
        <span className="btn-text-label">{label}</span>
        <span className="btn-chunky-tag">{version}</span>
      </span>
    </a>
  );
};
