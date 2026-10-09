import React, { useState } from 'react';
import { Camera, Award, MapPin, BarChart3, Sparkles } from 'lucide-react';

interface FeatureItem {
  id: string;
  badge: string;
  emoji: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  testPrompt: string;
  liveStats: { label: string; value: string }[];
}

const FEATURES: FeatureItem[] = [
  {
    id: 'scanner',
    badge: 'Core Vision AI',
    emoji: '🔍',
    title: 'AI Waste Scanner',
    description:
      'Snap a photo of household packaging to instantly know whether it belongs in recyclables, compost, or hazardous bins. Includes quick cleaning tips!',
    icon: <Camera size={24} color="#ffffff" />,
    accentColor: '#22c55e',
    testPrompt: 'Test recognition speed and classification accuracy on various physical packaging items.',
    liveStats: [
      { label: 'Classes', value: '4 Material Types' },
      { label: 'Speed', value: '~180ms on-device' }
    ]
  },
  {
    id: 'challenges',
    badge: 'Habit Quests',
    emoji: '🏆',
    title: 'Missions & Streaks',
    description:
      'Turn green living into a daily game. Complete sustainable mini-quests, earn shiny Green Points, and maintain your streak multiplier.',
    icon: <Award size={24} color="#ffffff" />,
    accentColor: '#84cc16',
    testPrompt: 'Verify that daily streaks correctly increment upon finishing at least 2 green actions.',
    liveStats: [
      { label: 'Daily Goals', value: '3 Active Quests' },
      { label: 'Multiplier', value: 'Up to 2x for streaks' }
    ]
  },
  {
    id: 'map',
    badge: 'Community Map',
    emoji: '🗺️',
    title: 'Drop-off Hubs & Map',
    description:
      'Find local drop-off centers for batteries, electronics, plastics, and community compost bins with cached coordinates for offline navigation.',
    icon: <MapPin size={24} color="#ffffff" />,
    accentColor: '#38bdf8',
    testPrompt: 'Test GPS radius filters and toggle map markers between general recycling and e-waste.',
    liveStats: [
      { label: 'Categories', value: 'Drop-offs & Hubs' },
      { label: 'Offline Mode', value: 'Cached coordinates' }
    ]
  },
  {
    id: 'tracker',
    badge: 'Impact Log',
    emoji: '🌱',
    title: 'Carbon Offset Log',
    description:
      'Watch your real impact grow! Transparent calculation of kilograms of CO2 saved and items prevented from ending up in local landfills.',
    icon: <BarChart3 size={24} color="#ffffff" />,
    accentColor: '#f59e0b',
    testPrompt: 'Verify cumulative metric math when logging multiple items during a single testing day.',
    liveStats: [
      { label: 'Metrics', value: 'kg CO2 & Diverted Items' },
      { label: 'Storage', value: 'Local SQLite & Cloud' }
    ]
  }
];

export const FeaturesShowcase: React.FC = () => {
  const [activeFeatureId, setActiveFeatureId] = useState<string>(FEATURES[0].id);

  return (
    <section id="features" className="section-cartoon-features" aria-labelledby="features-heading">
      <div className="container">
        <div className="cartoon-header-center">
          <div className="cartoon-badge-pill">
            <Sparkles size={15} color="#22c55e" />
            <span>Modules Under Testing</span>
          </div>
          <h2 id="features-heading" className="cartoon-section-title">
            Key Modules Ready for Playtesting
          </h2>
          <p className="cartoon-section-subtitle">
            Take each module for a spin during your testing sessions. We designed each feature to make sustainability fun and intuitive!
          </p>
        </div>

        {/* Feature Grid */}
        <div className="cartoon-features-grid">
          {FEATURES.map(feat => {
            const isSelected = feat.id === activeFeatureId;
            return (
              <div
                key={feat.id}
                className={`cartoon-feature-tile ${isSelected ? 'selected' : ''}`}
                onClick={() => setActiveFeatureId(feat.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveFeatureId(feat.id);
                  }
                }}
                aria-label={`Inspect ${feat.title}`}
              >
                <div className="feature-tile-header">
                  <div className="feature-tile-circle-icon" style={{ backgroundColor: feat.accentColor }}>
                    {feat.icon}
                  </div>
                  <span className="feature-tile-badge-tag" style={{ color: feat.accentColor, borderColor: feat.accentColor }}>
                    {feat.badge}
                  </span>
                </div>

                <h3 className="feature-tile-title">{feat.emoji} {feat.title}</h3>
                <p className="feature-tile-description">{feat.description}</p>

                <div className="feature-tile-stats-box">
                  {feat.liveStats.map((st, i) => (
                    <div key={i} className="stat-row-item">
                      <span className="stat-val-text">{st.value}</span>
                      <span className="stat-lbl-text">{st.label}</span>
                    </div>
                  ))}
                </div>

                <div className="feature-tile-quest-box">
                  <span className="quest-target-tag">Tester Quest:</span>
                  <span className="quest-target-text">{feat.testPrompt}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
