import React, { useState } from 'react';
import logoImg from '../../../logo/logo.png';
import { Smartphone, ShieldCheck, Download, Settings, Play, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface InstallationGuideProps {
  apkDownloadUrl: string;
  appVersion: string;
}

export const InstallationGuide: React.FC<InstallationGuideProps> = ({ apkDownloadUrl, appVersion }) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  return (
    <section id="install-guide" className="section-cartoon-install" aria-labelledby="install-heading">
      <div className="container">
        {/* Section Header with Mascot Companion */}
        <div className="cartoon-header-center">
          <div className="mascot-guide-bubble">
            <img
              src={logoImg}
              alt="EcoBud Guide"
              className="mascot-guide-img"
              width={54}
              height={54}
            />
            <div className="guide-dialogue">
              <span className="guide-name">EcoBud's Setup Guide:</span>
              <p className="guide-quote">"Follow these 3 simple quest steps to install the APK on your phone! Let's go!"</p>
            </div>
          </div>

          <h2 id="install-heading" className="cartoon-section-title">
            3-Step Android Installation Quest
          </h2>
          <p className="cartoon-section-subtitle">
            Because this is an active community test build, Android requires enabling unknown source permissions once. Tap each step to mark it complete!
          </p>
        </div>

        {/* Steps Grid */}
        <div className="cartoon-steps-grid">
          {/* STEP 1 */}
          <div className={`cartoon-step-card ${completedSteps[1] ? 'step-completed' : ''}`}>
            <div className="step-card-header-row">
              <span className="step-number-tag">Quest 01</span>
              <button
                type="button"
                className="step-quest-toggle-btn"
                onClick={() => toggleStep(1)}
                aria-label={`Mark step 1 as ${completedSteps[1] ? 'incomplete' : 'complete'}`}
              >
                <CheckCircle2
                  size={18}
                  color={completedSteps[1] ? '#22c55e' : '#94a3b8'}
                />
                <span>{completedSteps[1] ? 'Quest Done! ⭐' : 'Mark done'}</span>
              </button>
            </div>

            <div className="step-bubble-icon color-green">
              <Download size={26} color="#ffffff" />
            </div>

            <h3 className="step-heading">Download APK Package</h3>
            <p className="step-body-copy">
              Tap the download button to grab the <strong>{appVersion}</strong> build. If Chrome or your browser warns that <em>"File might be harmful"</em>, tap <strong>"Download anyway"</strong>.
            </p>

            <div className="step-mascot-tip">
              <ShieldCheck size={18} color="#22c55e" />
              <span>Standard Android browser alert for apps tested outside the Play Store. 100% clean!</span>
            </div>
          </div>

          {/* STEP 2 */}
          <div className={`cartoon-step-card ${completedSteps[2] ? 'step-completed' : ''}`}>
            <div className="step-card-header-row">
              <span className="step-number-tag">Quest 02</span>
              <button
                type="button"
                className="step-quest-toggle-btn"
                onClick={() => toggleStep(2)}
                aria-label={`Mark step 2 as ${completedSteps[2] ? 'incomplete' : 'complete'}`}
              >
                <CheckCircle2
                  size={18}
                  color={completedSteps[2] ? '#22c55e' : '#94a3b8'}
                />
                <span>{completedSteps[2] ? 'Quest Done! ⭐' : 'Mark done'}</span>
              </button>
            </div>

            <div className="step-bubble-icon color-amber">
              <Settings size={26} color="#ffffff" />
            </div>

            <h3 className="step-heading">Allow Unknown Apps</h3>
            <p className="step-body-copy">
              Open the downloaded file from your Downloads folder or notification drawer. Tap <strong>Settings</strong> and switch on <strong>"Allow from this source"</strong> for your browser.
            </p>

            <div className="step-mascot-tip">
              <AlertCircle size={18} color="#f59e0b" />
              <span>Grants install permissions for this package only. Keeps your device safe and sound!</span>
            </div>
          </div>

          {/* STEP 3 */}
          <div className={`cartoon-step-card ${completedSteps[3] ? 'step-completed' : ''}`}>
            <div className="step-card-header-row">
              <span className="step-number-tag">Quest 03</span>
              <button
                type="button"
                className="step-quest-toggle-btn"
                onClick={() => toggleStep(3)}
                aria-label={`Mark step 3 as ${completedSteps[3] ? 'incomplete' : 'complete'}`}
              >
                <CheckCircle2
                  size={18}
                  color={completedSteps[3] ? '#22c55e' : '#94a3b8'}
                />
                <span>{completedSteps[3] ? 'Quest Done! ⭐' : 'Mark done'}</span>
              </button>
            </div>

            <div className="step-bubble-icon color-sky">
              <Play size={26} color="#ffffff" />
            </div>

            <h3 className="step-heading">Install & Launch EcoBud</h3>
            <p className="step-body-copy">
              Tap <strong>Install</strong>, then tap <strong>Open</strong>! Grant camera permission when testing the AI waste scanner, log in, and start tracking your green streak!
            </p>

            <div className="step-mascot-tip">
              <Sparkles size={18} color="#38bdf8" />
              <span>Ready to explore! Tested across Android 8.0 through Android 15 phones.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
