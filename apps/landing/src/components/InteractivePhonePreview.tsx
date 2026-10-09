import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../../../logo/logo.png';
import {
  Camera,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Sparkles,
  Leaf,
  Layers,
  Award,
  Flame,
  RotateCw,
  Zap,
  Smile
} from 'lucide-react';

interface InteractivePhonePreviewProps {
  apkDownloadUrl: string;
  appVersion: string;
  qrTargetUrl: string;
  liteMode: boolean;
}

type PhoneTab = 'scanner' | 'missions' | 'impact';

interface WasteItem {
  id: string;
  name: string;
  emoji: string;
  category: 'Recyclable' | 'Compostable' | 'Hazardous';
  badgeColor: string;
  points: number;
  tip: string;
  mascotReaction: string;
}

const SAMPLE_ITEMS: WasteItem[] = [
  {
    id: 'bottle',
    name: 'PET Water Bottle',
    emoji: '🥤',
    category: 'Recyclable',
    badgeColor: '#22c55e',
    points: 15,
    tip: 'Empty liquid, crush flat, and toss into blue bin!',
    mascotReaction: 'Crush it flat and toss it in! High five! ✋'
  },
  {
    id: 'core',
    name: 'Apple Core Scrap',
    emoji: '🍎',
    category: 'Compostable',
    badgeColor: '#84cc16',
    points: 10,
    tip: 'Feed this tasty scrap to the organic compost bin!',
    mascotReaction: 'Nature loves fresh compost! Good karma! 🌱'
  },
  {
    id: 'battery',
    name: 'Lithium AA Battery',
    emoji: '🔋',
    category: 'Hazardous',
    badgeColor: '#f59e0b',
    points: 25,
    tip: 'Keep out of regular trash. Bring to battery hub!',
    mascotReaction: 'Whoa! Hazardous battery! Take to e-waste drop! ⚡'
  }
];

export const InteractivePhonePreview: React.FC<InteractivePhonePreviewProps> = ({
  apkDownloadUrl,
  appVersion,
  qrTargetUrl,
  liteMode
}) => {
  const [viewMode, setViewMode] = useState<'preview' | 'qr'>('preview');
  const [activeTab, setActiveTab] = useState<PhoneTab>('scanner');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<WasteItem>(SAMPLE_ITEMS[0]);
  const [completedMissions, setCompletedMissions] = useState<Record<string, boolean>>({
    'mission-1': true,
  });
  const [userPoints, setUserPoints] = useState(420);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const runSimulatedScan = (itemIndex: number) => {
    setSelectedItemIndex(itemIndex);
    setIsScanning(true);
    setTimeout(() => {
      setScanResult(SAMPLE_ITEMS[itemIndex]);
      setIsScanning(false);
      setUserPoints(prev => prev + SAMPLE_ITEMS[itemIndex].points);
    }, liteMode ? 200 : 500);
  };

  const toggleMission = (id: string, points: number) => {
    setCompletedMissions(prev => {
      const isNowComplete = !prev[id];
      setUserPoints(pts => isNowComplete ? pts + points : pts - points);
      return { ...prev, [id]: isNowComplete };
    });
  };

  return (
    <div className="cartoon-preview-wrapper">
      {/* Cartoon Mode Switcher Tabs */}
      <div className="cartoon-tabs-switch" role="tablist" aria-label="Device view options">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'preview'}
          className={`cartoon-tab-pill ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => setViewMode('preview')}
        >
          <Smartphone size={16} />
          <span>Interactive App Demo</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'qr'}
          className={`cartoon-tab-pill ${viewMode === 'qr' ? 'active' : ''}`}
          onClick={() => setViewMode('qr')}
        >
          <QrCode size={16} />
          <span>Scan Camera QR</span>
        </button>
      </div>

      {viewMode === 'preview' ? (
        /* CARTOON PHONE FRAME */
        <div className="cartoon-phone-shell">
          {/* Top Speaker & Camera Notch */}
          <div className="cartoon-notch">
            <span className="notch-camera" />
            <span className="notch-speaker" />
          </div>

          {/* Status Bar */}
          <div className="cartoon-phone-status">
            <span className="status-clock">09:41</span>
            <div className="status-icons">
              <span className="badge-signal">5G</span>
              <span className="badge-battery">100% ⚡</span>
            </div>
          </div>

          {/* App Header with Mascot Icon */}
          <div className="cartoon-app-header">
            <div className="cartoon-brand-item">
              <img
                src={logoImg}
                alt="EcoBud"
                className="cartoon-mini-mascot"
                width={32}
                height={32}
              />
              <span className="cartoon-brand-word">EcoBud</span>
            </div>
            <div className="cartoon-score-pill">
              <span className="score-coin">⭐</span>
              <span className="score-digits">{userPoints} PTS</span>
            </div>
          </div>

          {/* Screen Body */}
          <div className="cartoon-screen-body">
            {activeTab === 'scanner' && (
              <div className="cartoon-screen-content">
                <div className="cartoon-section-badge-row">
                  <span className="cartoon-label-tag">AI Vision Demo</span>
                  <span className="cartoon-helper-text">Pick an item to test sort:</span>
                </div>

                {/* Chunky Item Selection Buttons */}
                <div className="cartoon-item-pill-row" role="group" aria-label="Select test item">
                  {SAMPLE_ITEMS.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cartoon-item-btn ${selectedItemIndex === idx ? 'selected' : ''}`}
                      onClick={() => runSimulatedScan(idx)}
                      disabled={isScanning}
                      aria-label={`Test scan ${item.name}`}
                    >
                      <span className="item-emoji">{item.emoji}</span>
                      <span>{item.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Cartoon Viewfinder */}
                <div className="cartoon-viewfinder-card">
                  <div className="cartoon-bracket tl" />
                  <div className="cartoon-bracket tr" />
                  <div className="cartoon-bracket bl" />
                  <div className="cartoon-bracket br" />

                  {isScanning && !liteMode && <div className="cartoon-laser-beam" />}

                  <div className="cartoon-viewfinder-inner">
                    {isScanning ? (
                      <div className="scanning-animation-state">
                        <RotateCw size={26} className="spin-rotate" color="#22c55e" />
                        <span className="scanning-text">Analyzing object...</span>
                      </div>
                    ) : (
                      <div className="cartoon-result-display">
                        <div className="result-header-badge-row">
                          <span
                            className="cartoon-result-cat-pill"
                            style={{ backgroundColor: `${scanResult.badgeColor}25`, color: scanResult.badgeColor, borderColor: scanResult.badgeColor }}
                          >
                            {scanResult.category}
                          </span>
                          <span className="result-xp-reward">+{scanResult.points} Green Points</span>
                        </div>
                        <h4 className="cartoon-result-item-name">{scanResult.emoji} {scanResult.name}</h4>
                        <p className="cartoon-result-tip">{scanResult.tip}</p>

                        {/* Mascot Speech Bubble inside Viewfinder */}
                        <div className="viewfinder-mascot-speech">
                          <img
                            src={logoImg}
                            alt="EcoBud"
                            className="speech-avatar"
                            width={26}
                            height={26}
                          />
                          <span className="speech-quote">"{scanResult.mascotReaction}"</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scan Action Button */}
                <button
                  type="button"
                  className="cartoon-action-btn"
                  onClick={() => runSimulatedScan(selectedItemIndex)}
                  disabled={isScanning}
                >
                  <Camera size={16} />
                  <span>{isScanning ? 'Processing...' : 'Simulate Camera Scan'}</span>
                </button>
              </div>
            )}

            {activeTab === 'missions' && (
              <div className="cartoon-screen-content">
                <div className="cartoon-section-badge-row">
                  <span className="cartoon-label-tag">Daily Habits</span>
                  <span className="cartoon-helper-text">Tap to complete daily quests:</span>
                </div>

                <div className="cartoon-quest-list">
                  <button
                    type="button"
                    className={`cartoon-quest-card ${completedMissions['mission-1'] ? 'checked' : ''}`}
                    onClick={() => toggleMission('mission-1', 15)}
                    aria-label="Toggle Reusable Tumbler quest"
                  >
                    <div className="quest-checkbox-chunky">
                      {completedMissions['mission-1'] && <Check size={16} color="#ffffff" />}
                    </div>
                    <div className="quest-details">
                      <span className="quest-name">☕ Bring Reusable Tumbler</span>
                      <span className="quest-reward">+15 Points</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`cartoon-quest-card ${completedMissions['mission-2'] ? 'checked' : ''}`}
                    onClick={() => toggleMission('mission-2', 20)}
                    aria-label="Toggle Compost Scraps quest"
                  >
                    <div className="quest-checkbox-chunky">
                      {completedMissions['mission-2'] && <Check size={16} color="#ffffff" />}
                    </div>
                    <div className="quest-details">
                      <span className="quest-name">🥗 Separate Kitchen Organics</span>
                      <span className="quest-reward">+20 Points</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`cartoon-quest-card ${completedMissions['mission-3'] ? 'checked' : ''}`}
                    onClick={() => toggleMission('mission-3', 25)}
                    aria-label="Toggle Walk commute quest"
                  >
                    <div className="quest-checkbox-chunky">
                      {completedMissions['mission-3'] && <Check size={16} color="#ffffff" />}
                    </div>
                    <div className="quest-details">
                      <span className="quest-name">🚶 Walk or Bike 2 Kilometers</span>
                      <span className="quest-reward">+25 Points</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'impact' && (
              <div className="cartoon-screen-content">
                <div className="cartoon-section-badge-row">
                  <span className="cartoon-label-tag">Impact Stats</span>
                  <span className="cartoon-helper-text">Your verified green achievements:</span>
                </div>

                <div className="cartoon-stats-boxes">
                  <div className="cartoon-stat-tile">
                    <span className="stat-tile-emoji">🌍</span>
                    <span className="stat-tile-value">18.4 kg</span>
                    <span className="stat-tile-name">CO2 Prevented</span>
                  </div>
                  <div className="cartoon-stat-tile">
                    <span className="stat-tile-emoji">♻️</span>
                    <span className="stat-tile-value">47 items</span>
                    <span className="stat-tile-name">Waste Sorted</span>
                  </div>
                  <div className="cartoon-stat-tile full-tile">
                    <div className="streak-badge-row">
                      <Flame size={18} color="#f59e0b" />
                      <span className="stat-tile-value">7 Day Habit Streak</span>
                    </div>
                    <span className="stat-tile-name">Keep going for a 2x bonus multiplier!</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cartoon Bottom Navigation */}
          <div className="cartoon-phone-nav" role="tablist" aria-label="Demo app tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'scanner'}
              className={`cartoon-nav-item ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanner')}
              aria-label="Scanner Tab"
            >
              <Camera size={18} />
              <span>Scanner</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'missions'}
              className={`cartoon-nav-item ${activeTab === 'missions' ? 'active' : ''}`}
              onClick={() => setActiveTab('missions')}
              aria-label="Challenges Tab"
            >
              <Award size={18} />
              <span>Quests</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'impact'}
              className={`cartoon-nav-item ${activeTab === 'impact' ? 'active' : ''}`}
              onClick={() => setActiveTab('impact')}
              aria-label="Impact Tab"
            >
              <Layers size={18} />
              <span>Impact</span>
            </button>
          </div>
        </div>
      ) : (
        /* CARTOON QR CODE VIEW */
        <div className="cartoon-qr-card">
          <div className="cartoon-qr-badge">
            <img src={logoImg} alt="EcoBud" width={28} height={28} />
            <span>Scan with Mobile Camera</span>
          </div>

          <p className="cartoon-qr-text">
            Aim your Android phone camera or scanner app to download the APK directly.
          </p>

          <div className="cartoon-qr-white-frame">
            <QRCodeSVG
              value={qrTargetUrl}
              size={190}
              level="H"
              includeMargin={false}
            />
          </div>

          <div className="cartoon-qr-pill-meta">
            <span className="qr-meta-tag">Build: <strong>{appVersion}</strong></span>
            <span className="qr-meta-dot">•</span>
            <span className="qr-meta-tag">Arch: <strong>ARM64 / Universal</strong></span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="cartoon-copy-action-btn"
            aria-label="Copy direct download link to clipboard"
          >
            {copied ? (
              <>
                <Check size={16} color="#22c55e" />
                <span style={{ color: '#22c55e' }}>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Direct Download Link</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
