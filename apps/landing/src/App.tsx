import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Camera,
  ChartColumn,
  ChevronRight,
  Coins,
  Download,
  ExternalLink,
  Flame,
  Gift,
  House,
  Leaf,
  Menu,
  Plus,
  QrCode,
  Recycle,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { Lottie } from './Lottie';

const APK_URL =
  import.meta.env.VITE_APK_DOWNLOAD_URL ||
  'https://github.com/Lanczu1/Ecobud/releases/download/v1.1.1/Ecobud-Beta-v1.1.1.apk';
const VERSION = import.meta.env.VITE_APP_VERSION || 'v1.1.1';
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || '#feedback';

const TICKER = ['Tasks & Challenges', 'Eco Events', 'Learn & Grow', 'Give & Get', 'Redeem Coins', 'EcoBud AI'];

const FEATURES: { icon: ReactNode; tone: string; title: string; body: string; test: string }[] = [
  {
    icon: <Trophy size={28} strokeWidth={2.5} />,
    tone: 'green',
    title: 'Tasks & Challenges',
    body: 'Pick a mission that fits your day, submit your proof, and claim Eco Points and Eco Coins once a moderator approves it.',
    test: 'Submit one and watch its status change.',
  },
  {
    icon: <CalendarDays size={28} strokeWidth={2.5} />,
    tone: 'violet',
    title: 'Eco Events',
    body: 'Join clean-ups and tree planting drives near you, check in with the venue QR code, then claim your reward.',
    test: 'Join an event and try the QR check-in.',
  },
  {
    icon: <BookOpen size={28} strokeWidth={2.5} />,
    tone: 'mint',
    title: 'Learn & Grow',
    body: 'Short lessons and quizzes in the Eco Academy, such as Composting 101. No ID approval needed to start.',
    test: 'Finish a lesson, then claim its reward.',
  },
  {
    icon: <ArrowLeftRight size={28} strokeWidth={2.5} />,
    tone: 'blue',
    title: 'Give & Get',
    body: 'Swap items with your neighbours. List what you no longer need, request what others offer, and chat in the app.',
    test: 'Create a listing and send a request.',
  },
  {
    icon: <Coins size={28} strokeWidth={2.5} />,
    tone: 'gold',
    title: 'Redeem Coins',
    body: 'Exchange Eco Coins for rewards and follow each request in your Coins History.',
    test: 'Make a redeem request and check its status.',
  },
  {
    icon: <Sparkles size={28} strokeWidth={2.5} />,
    tone: 'green',
    title: 'EcoBud AI',
    body: 'Ask the built-in assistant a question from Home, or use it as a tutor in lessons and a guide in challenges.',
    test: 'Ask it something and tell us if the answer helped.',
  },
];

const STREAK = [
  { n: 3, reward: '30 pts', note: 'Flame unlocks' },
  { n: 10, reward: '100 pts + 5 coins', note: '' },
  { n: 30, reward: '300 pts + 15 coins', note: '' },
  { n: 100, reward: '1,000 pts + 50 coins', note: 'Challenge Champion badge' },
];

const EVENT_STEPS = [
  { icon: <CalendarCheck size={26} strokeWidth={2.5} />, title: 'Join', body: 'Tap Join Event and your slot is reserved.' },
  { icon: <Camera size={26} strokeWidth={2.5} />, title: 'Show up', body: 'Go to the venue and take a proof photo.' },
  { icon: <QrCode size={26} strokeWidth={2.5} />, title: 'Scan', body: 'Scan the QR code. A valid code approves your attendance.' },
  { icon: <Gift size={26} strokeWidth={2.5} />, title: 'Claim', body: 'Tap Claim Reward for Eco Points and Eco Coins.' },
];

const INSTALL = [
  {
    title: 'Download the APK',
    body: `Tap Download for ${VERSION}. If Chrome says the file might be harmful, choose Download anyway. Android shows this for any APK that did not come from Google Play.`,
  },
  {
    title: 'Allow the install',
    body: 'Open the file. When Android asks, open Settings and switch on Allow from this source for your browser or file manager.',
  },
  {
    title: 'Open and sign in',
    body: 'Tap Install, then Open. Sign in with an email code or Google.',
  },
];

const FAQ = [
  {
    q: 'Why does Android warn me about the file?',
    a: 'Android flags any APK downloaded through a browser instead of Google Play. The build is attached to our public GitHub release.',
  },
  {
    q: 'Which phones work?',
    a: 'Android 8.0 or newer.',
  },
  {
    q: 'Do I need to verify my ID?',
    a: 'Not to look around. You can browse challenges, events and the Give & Get Hub and finish every lesson right away. Joining challenges, joining events and posting or requesting listings need an approved ID. Submit your name and an ID photo in the app, and a moderator from your barangay reviews it.',
  },
  {
    q: 'What are Eco Points and Eco Coins?',
    a: 'Both come from challenges, events, lessons and habits. Points track your level and streak bonuses. Coins are what you spend on rewards.',
  },
  {
    q: 'How do streaks work?',
    a: 'Finish 3 challenges to unlock the flame. It goes gray after seven days without a completed challenge, but your count never resets. You can restore a gray flame up to three times a calendar month.',
  },
  {
    q: 'Where do I report bugs?',
    a: 'Use the feedback form in the header or the footer. Screenshots help a lot.',
  },
];

function isLowEnd(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    nav.connection?.saveData === true
  );
}

/** Pop elements in once as they scroll into view; pause infinite loops while off screen. */
function useScrollMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            reveal.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    const loops = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('paused', !e.isIntersecting);
    });
    document.querySelectorAll('.pop').forEach((el) => reveal.observe(el));
    document.querySelectorAll('[data-loop]').forEach((el) => loops.observe(el));
    const onVis = () => document.documentElement.classList.toggle('tab-hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      reveal.disconnect();
      loops.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);
}

/** A drawn copy of the app's Home tab, so the page looks like the product. */
function PhonePreview() {
  return (
    <div className="phone" role="img" aria-label="Preview of the EcoBud home screen">
      <div className="phone-screen" aria-hidden="true">
        <div className="ph-top">
          <span className="ph-avatar">E</span>
          <span className="ph-icons">
            <ChartColumn size={18} strokeWidth={2.5} />
            <CalendarDays size={18} strokeWidth={2.5} />
            <Bell size={18} strokeWidth={2.5} fill="currentColor" />
          </span>
        </div>
        <p className="ph-eyebrow">Good morning</p>
        <p className="ph-name">Eco neighbour</p>
        <div className="ph-ask">
          <span className="ph-spark"><Sparkles size={14} strokeWidth={2.5} /></span>
          <span className="ph-ask-text">Ask EcoBud AI a question...</span>
          <b>AI <ChevronRight size={12} strokeWidth={3} /></b>
        </div>
        <ul className="ph-tiles">
          <li className="t-green"><span><Leaf size={16} strokeWidth={2.5} /></span>My Progress</li>
          <li className="t-gold"><span><Coins size={16} strokeWidth={2.5} /></span>Redeem Coins</li>
          <li className="t-blue"><span><ArrowLeftRight size={16} strokeWidth={2.5} /></span>Give &amp; Get</li>
          <li className="t-violet"><span><CalendarDays size={16} strokeWidth={2.5} /></span>Eco Events</li>
        </ul>
        <div className="ph-level">
          <div className="ph-level-head">
            <span className="ph-recycle"><Recycle size={18} strokeWidth={2.5} /></span>
            <div>
              <small>Level 4</small>
              <strong>Eco Warrior</strong>
            </div>
          </div>
          <p className="ph-points"><b>625</b> Eco Points</p>
          <p className="ph-to">375 Eco Points to Level 5</p>
          <div className="ph-bar"><i /></div>
          <p className="ph-next"><span>Next: Eco Champion</span><span>625 / 1000</span></p>
        </div>
        <div className="ph-stats">
          <span><Flame size={16} strokeWidth={2.5} /> Challenge streak</span>
          <span><Trophy size={16} strokeWidth={2.5} /> Weekly rank</span>
        </div>
        <div className="ph-tabs">
          <span className="on"><House size={16} strokeWidth={2.5} />Home</span>
          <span><BookOpen size={16} strokeWidth={2.5} />Learn</span>
          <span className="mid"><Trophy size={20} strokeWidth={2.5} /></span>
          <span><ShoppingCart size={16} strokeWidth={2.5} />G&amp;G</span>
          <span><User size={16} strokeWidth={2.5} />Profile</span>
        </div>
      </div>
    </div>
  );
}

function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const loaded = useRef(document.readyState === 'complete');

  useEffect(() => {
    const onLoad = () => (loaded.current = true);
    window.addEventListener('load', onLoad);
    const start = performance.now();
    const MIN = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / MIN, 1);
      const cap = loaded.current ? 100 : 90;
      setPct((p) => Math.min(Math.max(p, Math.round(t * 100)), cap));
      if (t >= 1 && loaded.current) {
        setPct(100);
        setLeaving(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('load', onLoad);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(onDone, 650);
    return () => window.clearTimeout(id);
  }, [leaving, onDone]);

  return (
    <div className={`loader${leaving ? ' leave' : ''}`} role="status" aria-label="Loading EcoBud">
      <div className="loader-stage">
        <span className="loader-ring" />
        <Lottie name="loading" eager />
      </div>
      <p className="loader-title">
        {'EcoBud'.split('').map((c, i) => (
          <span key={i} style={{ animationDelay: `${i * 80}ms` }}>
            {c}
          </span>
        ))}
      </p>
      <div className="loader-track">
        <i style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="loader-pct">{pct}%</p>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('lite', isLowEnd());
  }, []);

  useEffect(() => {
    document.body.style.overflow = loading ? 'hidden' : '';
  }, [loading]);

  useScrollMotion(true);

  const finishLoading = useCallback(() => setLoading(false), []);

  return (
    <>
      {loading && <Loader onDone={finishLoading} />}
      <div className={`page${loading ? ' booting' : ' ready'}`}>
        <header className="top">
          <a className="mark" href="#top" aria-label="EcoBud home">
            <span className="mark-dot"><img src="/ecobud_logo_circle.png" alt="EcoBud logo" /></span>
            EcoBud
          </a>
          <nav className={menu ? 'open' : ''} aria-label="Main">
            <a href="#inside" onClick={() => setMenu(false)}>What&apos;s inside</a>
            <a href="#streak" onClick={() => setMenu(false)}>Streaks</a>
            <a href="#install" onClick={() => setMenu(false)}>Install</a>
            <a href="#faq" onClick={() => setMenu(false)}>FAQ</a>
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">Feedback</a>
          </nav>
          <a className="btn sm" href={APK_URL}>
            <Download size={16} strokeWidth={3} /> Get APK
          </a>
          <button
            className="burger"
            type="button"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <X size={22} strokeWidth={3} /> : <Menu size={22} strokeWidth={3} />}
          </button>
        </header>

        <main id="top">
          <section className="hero">
            <div className="hero-copy">
              <p className="dateline">
                <span>Beta {VERSION}</span>
                <span>Android 8.0+</span>
                <span>Nagcarlan barangays</span>
              </p>
              <h1 className="mega">
                <span className="line"><span>Small habits.</span></span>
                <span className="line"><span>Big <em>barangay.</em></span></span>
              </h1>
              <p className="lede">
                EcoBud turns clean-ups, lessons and neighbourly swaps into a daily game. Finish
                challenges, check in at eco events, keep your streak alive, and earn points and
                coins you can spend. We are testing the Android build now.
              </p>
              <div className="cta">
                <a className="btn" href={APK_URL}>
                  <Download size={20} strokeWidth={3} /> Download APK <small>{VERSION}</small>
                </a>
                <a className="btn ghost" href="#install">
                  <Smartphone size={20} strokeWidth={3} /> How to install
                </a>
              </div>
            </div>

            <div className="hero-art" data-loop>
              <div className="blob" aria-hidden="true" />
              <PhonePreview />
              <Lottie name="mascot" className="hero-mascot" label="EcoBud mascot waving" eager />
              <span className="sticker s-coin" aria-hidden="true"><Coins size={26} strokeWidth={2.5} /></span>
              <span className="sticker s-leaf" aria-hidden="true"><Leaf size={26} strokeWidth={2.5} /></span>
              <span className="sticker s-star" aria-hidden="true"><Star size={22} strokeWidth={2.5} /></span>
            </div>
          </section>

          <div className="ticker" aria-hidden="true" data-loop>
            <div className="track">
              {[0, 1].map((n) => (
                <div key={n} className="set">
                  {[...TICKER, ...TICKER].map((t, i) => (
                    <span key={`${n}-${i}`}>
                      {t}
                      <Star size={22} strokeWidth={3} fill="currentColor" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <section className="block" id="inside">
            <header className="sec-head pop">
              <p className="folio">Section 01</p>
              <h2 className="big">What&apos;s inside</h2>
              <p className="deck">Six parts of the app are ready for you to poke at. Each card says what we most want checked.</p>
            </header>
            <ul className="cards">
              {FEATURES.map((f, i) => (
                <li key={f.title} className={`card pop tone-${f.tone}`} style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
                  <span className="icon-tile">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <p className="try"><b>Try:</b> {f.test}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="block streak-block" id="streak">
            <header className="sec-head pop">
              <Lottie name="fire" className="streak-fire" />
              <p className="folio">Section 02</p>
              <h2 className="big">Light your streak</h2>
              <p className="deck">
                Every completed challenge adds to your count. Hit a milestone and the bonus is paid
                automatically, once.
              </p>
            </header>
            <ol className="ladder">
              {STREAK.map((s, i) => (
                <li key={s.n} className={`rung pop r${i}`} style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="rung-top">
                    <Lottie name="fire" className="rung-fire" />
                    <strong>{s.n}</strong>
                    <span className="unit">challenges</span>
                  </div>
                  <p className="reward">{s.reward}</p>
                  {s.note && <p className="note">{s.note}</p>}
                </li>
              ))}
            </ol>
            <p className="fine pop">
              The flame turns gray after seven days without a completed challenge, but your count
              stays. Restore it up to three times a month.
            </p>
          </section>

          <section className="block" id="events">
            <header className="sec-head pop">
              <p className="folio">Section 03</p>
              <h2 className="big">An event in four taps</h2>
            </header>
            <ol className="flow">
              {EVENT_STEPS.map((s, i) => (
                <li key={s.title} className="flow-step pop" style={{ transitionDelay: `${i * 90}ms` }}>
                  <span className="flow-n">{i + 1}</span>
                  <span className="icon-tile">{s.icon}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="block install" id="install">
            <header className="sec-head pop">
              <p className="folio">Section 04</p>
              <h2 className="big">Install in three steps</h2>
            </header>
            <ol className="steps">
              {INSTALL.map((s, i) => (
                <li key={s.title} className="step pop" style={{ transitionDelay: `${i * 90}ms` }}>
                  <span className="digit">{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="install-foot pop">
              <a className="btn" href={APK_URL}>
                <Download size={20} strokeWidth={3} /> Download APK <small>{VERSION}</small>
              </a>
              <p className="safe"><ShieldCheck size={20} strokeWidth={2.5} /> Public GitHub release, no account needed to download.</p>
            </div>
          </section>

          <section className="block" id="faq">
            <header className="sec-head pop">
              <p className="folio">Section 05</p>
              <h2 className="big">Questions</h2>
            </header>
            <div className="faq">
              {FAQ.map((f, i) => (
                <details key={f.q} className="pop" open={i === 0}>
                  <summary>
                    {f.q}
                    <span className="plus"><Plus size={20} strokeWidth={3.5} /></span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="finale" id="feedback">
            <div className="finale-in">
              <div className="pop">
                <h2 className="mega">Found a bug? Tell us.</h2>
                <p className="lede">Every report from a tester makes the public release better.</p>
                <div className="cta">
                  <a className="btn dark" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
                    Send feedback <ExternalLink size={20} strokeWidth={3} />
                  </a>
                  <a className="btn ghost" href={APK_URL}>
                    <Download size={20} strokeWidth={3} /> Download APK
                  </a>
                </div>
              </div>
              <div className="finale-art pop">
                <Lottie name="confetti" className="confetti" />
                <Lottie name="celebrate" label="EcoBud mascot celebrating" />
              </div>
            </div>
          </section>
        </main>

        <footer className="foot">
          <span className="mark-dot"><img src="/ecobud_logo_circle.png" alt="EcoBud logo" /></span>
          <span>EcoBud {VERSION} beta</span>
          <span>&copy; {new Date().getFullYear()} EcoBud Project</span>
          <a href="#top">Back to top</a>
        </footer>
      </div>
    </>
  );
}
