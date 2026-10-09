import React, { useEffect, useState } from 'react';
import logoImg from '../../../logo/logo.png';
import { Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  onFinished: () => void;
  liteMode: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinished, liteMode }) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [bubbleText, setBubbleText] = useState('Sprouting fresh leaves... 🌱');

  useEffect(() => {
    // Lock background page scroll while loading screen is active
    document.body.style.overflow = 'hidden';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = liteMode || prefersReducedMotion ? 400 : 1000;
    const stepTime = 40;
    const totalSteps = duration / stepTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const currentProgress = Math.min(100, Math.round((currentStep / totalSteps) * 100));
      setProgress(currentProgress);

      if (currentProgress >= 25 && currentProgress < 60) {
        setBubbleText('Packing Android ARM64 APK... 📦');
      } else if (currentProgress >= 60 && currentProgress < 90) {
        setBubbleText('Warming up AI vision scanner... 🔍');
      } else if (currentProgress >= 90) {
        setBubbleText("Woohoo! We're all set! ✨");
      }

      if (currentStep >= totalSteps) {
        clearInterval(timer);
        setIsFadingOut(true);
        setTimeout(() => {
          document.body.style.overflow = '';
          onFinished();
        }, 350);
      }
    }, stepTime);

    return () => {
      clearInterval(timer);
      document.body.style.overflow = '';
    };
  }, [liteMode, onFinished]);

  const handleSkip = () => {
    document.body.style.overflow = '';
    setIsFadingOut(true);
    setTimeout(onFinished, 150);
  };

  return (
    <aside
      className={`cartoon-loading-screen ${isFadingOut ? 'fade-out' : ''} ${liteMode ? 'lite' : ''}`}
      aria-label="Application loading"
      aria-live="polite"
      aria-busy={!isFadingOut}
    >
      <div className="cartoon-loading-box">
        {/* Floating Cartoon Cloud Accents */}
        <div className="cartoon-cloud-decor cloud-1" aria-hidden="true" />
        <div className="cartoon-cloud-decor cloud-2" aria-hidden="true" />

        {/* Mascot Cartoon Speech Bubble */}
        <div className="cartoon-speech-bubble" role="status">
          <span>{bubbleText}</span>
          <div className="bubble-tail" aria-hidden="true" />
        </div>

        {/* Animated Bouncing EcoBud Mascot */}
        <div className="mascot-loading-bounce-wrap">
          <div className="mascot-shadow" aria-hidden="true" />
          <img
            src={logoImg}
            alt="EcoBud Mascot Leaf Character"
            className="mascot-loading-character"
            width={120}
            height={120}
          />
        </div>

        {/* Title */}
        <div className="cartoon-loading-title-row">
          <span className="cartoon-title-bold">ECOBUD</span>
          <span className="cartoon-tag-pill">Beta Quest</span>
        </div>

        {/* Chunky 3D Progress Bar */}
        <div
          className="cartoon-progress-frame"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="cartoon-progress-fill"
            style={{ width: `${progress}%` }}
          >
            <span className="progress-stripes" aria-hidden="true" />
          </div>
        </div>

        {/* Footer info & skip button */}
        <div className="cartoon-loading-footer">
          <span className="cartoon-progress-count">{progress}% Ready</span>
          <button
            type="button"
            onClick={handleSkip}
            className="cartoon-skip-btn"
            aria-label="Skip loading animation and enter landing page"
          >
            <span>Skip into app &gt;</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
