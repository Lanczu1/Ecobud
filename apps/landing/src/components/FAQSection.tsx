import React, { useState } from 'react';
import logoImg from '../../../logo/logo.png';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FAQItem {
  id: string;
  emoji: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 'harmful-warning',
    emoji: '🛡️',
    question: 'Why does Android show "File might be harmful" when downloading?',
    answer:
      'This is standard Android system behavior whenever downloading an APK through your web browser rather than Google Play Store. The EcoBud APK is built directly from our open repository release and does not contain malicious code or unwanted tracking software.'
  },
  {
    id: 'device-compatibility',
    emoji: '📱',
    question: 'What devices and Android versions are supported?',
    answer:
      'EcoBud supports Android 8.0 (Oreo) and higher, targeting ARM64-v8a and universal Android architectures. It has been tested across phones from Samsung, Xiaomi, Google Pixel, and Motorola.'
  },
  {
    id: 'camera-privacy',
    emoji: '🔒',
    question: 'How does the AI waste scanner handle camera photos?',
    answer:
      'The camera viewfinder processes image frames locally for material identification (plastics, paper, organic compost, metals, and e-waste). Your camera frames are not uploaded to public cloud servers or stored for advertising purposes.'
  },
  {
    id: 'offline-mode',
    emoji: '📶',
    question: 'Can I use EcoBud without an active internet connection?',
    answer:
      'Yes! Core waste sorting tips and previously cached drop-off locations are accessible offline. Internet connectivity is only needed when syncing completed daily missions, updating leaderboards, and submitting tester feedback.'
  },
  {
    id: 'submit-feedback',
    emoji: '💡',
    question: 'Where can I submit bug reports and feature ideas?',
    answer:
      'Use the dedicated Tester Feedback button in the navigation header or at the bottom of this page. You can also report issues directly with screenshots through our Google Forms submission portal.'
  }
];

export const FAQSection: React.FC = () => {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    'harmful-warning': true
  });

  const toggleItem = (id: string) => {
    setOpenIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <section id="faq" className="section-cartoon-faq" aria-labelledby="faq-heading">
      <div className="container">
        <div className="cartoon-header-center">
          <div className="mascot-faq-speech">
            <img
              src={logoImg}
              alt="EcoBud Mascot"
              className="mascot-faq-img"
              width={48}
              height={48}
            />
            <div className="mascot-faq-text">
              <span className="faq-bubble-speaker">EcoBud Knowledge Base:</span>
              <p className="faq-bubble-quote">"Got questions about the beta APK? I've got answers!"</p>
            </div>
          </div>

          <h2 id="faq-heading" className="cartoon-section-title">
            Frequently Asked Questions
          </h2>
          <p className="cartoon-section-subtitle">
            Answers to common questions regarding APK sideloading, hardware compatibility, and tester data.
          </p>
        </div>

        <div className="cartoon-faq-list">
          {FAQ_DATA.map(item => {
            const isOpen = !!openIds[item.id];
            return (
              <div key={item.id} className={`cartoon-faq-card ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="cartoon-faq-trigger"
                  onClick={() => toggleItem(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                >
                  <span className="faq-question-label">
                    <span className="faq-q-emoji">{item.emoji}</span>
                    <span>{item.question}</span>
                  </span>
                  <div className={`faq-chevron-bubble ${isOpen ? 'rotated' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </button>
                <div
                  id={`faq-answer-${item.id}`}
                  className="cartoon-faq-body"
                  role="region"
                  aria-hidden={!isOpen}
                >
                  <p className="faq-answer-copy">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
