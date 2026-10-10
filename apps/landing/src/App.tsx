<<<<<<< HEAD
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Menu,
  Play,
  Plus,
  QrCode,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Lottie } from './Lottie';
import previewVideo from '../assets/EcoBudAd3.mp4';
=======
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Copy, Download, ExternalLink, Menu, Plus, QrCode, ShieldCheck, Smartphone, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Lottie } from './Lottie';
>>>>>>> origin/main

const APK_URL =
  import.meta.env.VITE_APK_DOWNLOAD_URL ||
  'https://github.com/Lanczu1/Ecobud/releases/download/v1.1.1/Ecobud-Beta-v1.1.1.apk';
const VERSION = import.meta.env.VITE_APP_VERSION || 'v1.1.1';
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || '#feedback';

<<<<<<< HEAD
const VIEWS = [
  { id: 'preview', label: 'Preview', Icon: Play },
  { id: 'overview', label: 'Overview', Icon: QrCode },
] as const;
type View = (typeof VIEWS)[number]['id'];

=======
>>>>>>> origin/main
const TESTS: { title: string; body: string; test: string; fire?: boolean }[] = [
  {
    title: 'Tasks & Challenges',
    body: 'Pick a mission that fits your day, submit your proof, and claim Eco Points and Eco Coins once a moderator approves it.',
    test: 'Submit one and watch its status change.',
  },
  {
    title: 'Challenge streaks',
    body: 'Finish 3 challenges to light the flame. Bonuses are paid once each at 3, 10, 30 and 100 challenges.',
    test: 'Complete three and check that the flame turns on.',
    fire: true,
  },
  {
    title: 'Eco Events',
    body: 'Join clean-ups and tree planting drives near you, check in with the venue QR code, then claim your reward.',
    test: 'Join an event and try the QR check-in.',
  },
  {
    title: 'Learn & Grow',
    body: 'Short lessons and quizzes in the Eco Academy, such as Composting 101. No ID approval needed to start.',
    test: 'Finish a lesson, then claim its reward.',
  },
  {
    title: 'Give & Get',
    body: 'Swap items with your neighbours. List what you no longer need, request what others offer, and chat in the app.',
    test: 'Create a listing and send a request.',
  },
  {
    title: 'Redeem Coins',
    body: 'Exchange Eco Coins for rewards and follow each request in your Coins History.',
    test: 'Make a redeem request and check its status.',
  },
  {
    title: 'EcoBud AI',
    body: 'Ask the built-in assistant a question from Home, or use it as a tutor in lessons and a guide in challenges.',
    test: 'Ask it something and tell us if the answer helped.',
  },
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
    a: 'Use the feedback form in the header or at the bottom of this page. Screenshots help a lot.',
  },
];

/** Reveal elements once as they scroll into view, mark the nav link of the section on screen, and pause loops while off screen. */
function useScrollMotion() {
  useEffect(() => {
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
    const links = document.querySelectorAll<HTMLAnchorElement>('.top nav a[href^="#"]');
    // A section counts as current while it crosses the middle of the screen.
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          links.forEach((a) => {
            if (a.hash === `#${e.target.id}`) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    document.querySelectorAll('main section[id]').forEach((el) => spy.observe(el));
    document.querySelectorAll('.pop').forEach((el) => reveal.observe(el));
    document.querySelectorAll('[data-loop]').forEach((el) => loops.observe(el));
    const onVis = () => document.documentElement.classList.toggle('tab-hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      reveal.disconnect();
      loops.disconnect();
      spy.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}

/**
 * Animated scrolling for every in-page link (nav tabs, Install guide button, logo, Back to top).
 * Scripted so it still runs where the browser's own smooth scrolling is switched off.
 */
function useAnchorScroll() {
  useEffect(() => {
    let raf = 0;
    let cue = 0;
    const stop = () => cancelAnimationFrame(raf);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || link.target === '_blank') return;
      const target = document.querySelector<HTMLElement>(link.hash);
      if (!target) return;
      e.preventDefault();
      stop();

      const header = document.querySelector('.top')?.getBoundingClientRect().height ?? 0;
      const from = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const wanted = target.id === 'top' ? 0 : from + target.getBoundingClientRect().top - header - 20;
      const to = Math.min(max, Math.max(0, wanted));
      // Longer trips take longer, within limits, so short hops stay quick.
      const duration = Math.min(1100, Math.max(450, Math.abs(to - from) * 0.45));
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        window.scrollTo(0, from + (to - from) * eased);
        if (t < 1) {
          raf = requestAnimationFrame(step);
          return;
        }
        // Keyboard and screen reader users continue from the section they jumped to.
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        target.classList.add('arrived');
        window.clearTimeout(cue);
        cue = window.setTimeout(() => target.classList.remove('arrived'), 1200);
      };
      raf = requestAnimationFrame(step);
      history.pushState(null, '', link.hash);
    };

    // Any scroll input from the visitor takes over from the animation.
    document.addEventListener('click', onClick);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return () => {
      stop();
      window.clearTimeout(cue);
      document.removeEventListener('click', onClick);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, []);
}

function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const loaded = useRef(document.readyState === 'complete');

  useEffect(() => {
    const onLoad = () => (loaded.current = true);
    window.addEventListener('load', onLoad);
    const start = performance.now();
    const MIN = 900;
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

/** Desktop visitors scan this with their phone; the button covers anyone who would rather send the link. */
function ScanCard() {
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (copy === 'idle') return;
    const id = window.setTimeout(() => setCopy('idle'), 2400);
    return () => window.clearTimeout(id);
  }, [copy]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(APK_URL);
      setCopy('done');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <aside className="scan" aria-labelledby="scan-title">
      <Lottie name="mascot" className="scan-mascot" eager />
      <div className="scan-card">
        <h2 id="scan-title">
          <QrCode size={20} strokeWidth={2.25} /> Scan with your phone camera
        </h2>
        <p>Point your Android camera or QR scanner at the code to download the APK straight to your phone.</p>
        <div className="qr" data-loop>
          <QRCodeSVG value={APK_URL} size={208} level="M" marginSize={0} bgColor="#ffffff" fgColor="#0b1611" title="QR code for the EcoBud APK download" />
        </div>
        <button className={`btn ghost copy ${copy}`} type="button" onClick={copyLink}>
          {copy === 'done' ? <Check size={18} strokeWidth={2.5} /> : <Copy size={18} strokeWidth={2.25} />}
          <span aria-live="polite">
            {copy === 'done' ? 'Link copied' : copy === 'failed' ? 'Copy blocked, use Download' : 'Copy download link'}
          </span>
        </button>
      </div>
    </aside>
  );
}

<<<<<<< HEAD
function useMedia(query: string) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** The hero's right column: the looping preview video and the QR card share one spot, switched by two tabs. */
function HeroStage() {
  const [view, setView] = useState<View>('preview');
  const [clip, setClip] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [height, setHeight] = useState<number>();
  const [sound, setSound] = useState(false);
  const [theater, setTheater] = useState(false);
  // A QR code is no use on the phone that is already showing it, so phones get the video alone.
  const phone = useMedia('(max-width: 760px)');
  const shown: View = phone ? 'preview' : view;
  const panels = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const bigVideo = useRef<HTMLVideoElement>(null);

  // The two panels differ in height, so the stage follows whichever one is showing.
  useLayoutEffect(() => {
    const el = panels.current?.querySelector<HTMLElement>('.on');
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);

  // The video has no controls, so it only runs while someone can see it.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let onScreen = false;
    const sync = () => {
      if (shown !== 'preview' || !onScreen || document.hidden || theater) return v.pause();
      // Some browsers refuse to resume with sound unless a tap started it, so fall back to silent.
      v.play().catch(() => {
        if (v.muted) return;
        setSound(false);
        v.muted = true;
        v.play().catch(() => {});
      });
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(v);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [shown, theater]);

  // The large view picks up where the small one was, and hands the position back when it closes.
  useEffect(() => {
    const d = dialog.current;
    const big = bigVideo.current;
    const v = video.current;
    if (!theater || !d || !big || !v) return;
    d.showModal();
    big.currentTime = v.currentTime;
    big.play().catch(() => {});
    return () => {
      v.currentTime = big.currentTime;
      big.pause();
    };
  }, [theater]);

  const soundButton = (
    <button type="button" aria-label={sound ? 'Turn sound off' : 'Turn sound on'} onClick={() => setSound((s) => !s)}>
      {sound ? <Volume2 size={20} strokeWidth={2.25} /> : <VolumeX size={20} strokeWidth={2.25} />}
    </button>
  );

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next: View = view === 'preview' ? 'overview' : 'preview';
    setView(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const panel = (id: View) => ({
    className: `stage-panel${shown === id ? ' on' : ''}`,
    id: `panel-${id}`,
    'data-view': id,
    role: phone ? undefined : 'tabpanel',
    'aria-labelledby': phone ? undefined : `tab-${id}`,
  });

  return (
    <div className="stage">
      {!phone && (
        <div className="stage-tabs" role="tablist" aria-label="Preview video or download overview" data-view={view} onKeyDown={onKeys}>
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={view === id}
              aria-controls={`panel-${id}`}
              tabIndex={view === id ? 0 : -1}
              onClick={() => setView(id)}
            >
              <Icon size={16} strokeWidth={2.5} /> {label}
            </button>
          ))}
        </div>
      )}
      <div className="stage-panels" ref={panels} style={{ height }}>
        <div {...panel('preview')}>
          <figure>
            <div className={`clip ${clip}`}>
              {clip === 'loading' && <span className="loader-ring" role="status" aria-label="Loading the preview video" />}
              {clip === 'failed' ? (
                <p>The preview video could not load. Reload the page to try again.</p>
              ) : (
                <video
                  ref={video}
                  src={previewVideo}
                  muted={!sound}
                  loop
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  aria-label="EcoBud preview video"
                  onLoadedMetadata={() => setClip('ready')}
                  onError={() => setClip('failed')}
                />
              )}
              {clip === 'ready' && (
                <div className="clip-tools">
                  {soundButton}
                  {/* On a phone the large view would be no bigger than the video already is. */}
                  {!phone && (
                    <button type="button" aria-label="Open the video in a large view" onClick={() => setTheater(true)}>
                      <Maximize2 size={20} strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <figcaption>EcoBud in 30 seconds, on a loop. Sound starts off.</figcaption>
          </figure>
        </div>
        {!phone && (
          <div {...panel('overview')}>
            <ScanCard />
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="theater"
        aria-label="EcoBud preview video"
        onClose={() => setTheater(false)}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        {theater && (
          <div className="clip">
            <video ref={bigVideo} src={previewVideo} muted={!sound} loop playsInline disablePictureInPicture aria-label="EcoBud preview video" />
            <div className="clip-tools">
              {soundButton}
              <button type="button" aria-label="Close the large view" onClick={() => dialog.current?.close()}>
                <X size={20} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

=======
>>>>>>> origin/main
export default function App() {
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.body.style.overflow = loading ? 'hidden' : '';
  }, [loading]);

  useScrollMotion();
  useAnchorScroll();

  const finishLoading = useCallback(() => setLoading(false), []);

  return (
    <>
      {loading && <Loader onDone={finishLoading} />}
      <div className={`page${loading ? ' booting' : ' ready'}`}>
        <header className="top">
          <a className="mark" href="#top" aria-label="EcoBud home">
            <span className="mark-dot"><img src="/logo-96.webp" alt="" width={36} height={36} /></span>
            EcoBud <small>beta</small>
          </a>
          <nav className={menu ? 'open' : ''} aria-label="Main">
            <a href="#install" onClick={() => setMenu(false)}>Install guide</a>
            <a href="#test" onClick={() => setMenu(false)}>What to test</a>
            <a href="#faq" onClick={() => setMenu(false)}>Questions</a>
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>Send feedback</a>
          </nav>
          <a className="btn sm" href={APK_URL}>
            <Download size={16} strokeWidth={2.5} /> Download APK
          </a>
          <button
            className="burger"
            type="button"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
          </button>
          <span className="progress" aria-hidden="true" />
        </header>

        <main id="top">
          <section className="hero">
            <div className="hero-copy">
              <p className="dateline">Android beta {VERSION} for Nagcarlan barangays</p>
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
                  <Download size={20} strokeWidth={2.5} /> Download APK <small>{VERSION}</small>
                </a>
                <a className="btn ghost" href="#install">
                  <Smartphone size={20} strokeWidth={2.25} /> Install guide
                </a>
              </div>
              <ul className="facts">
                <li>Android 8.0 or newer</li>
                <li>Public GitHub release</li>
                <li>No account needed to download</li>
              </ul>
            </div>
<<<<<<< HEAD
            <HeroStage />
=======
            <ScanCard />
>>>>>>> origin/main
          </section>

          <section className="block" id="test">
            <header className="sec-head pop">
              <h2 className="big">What to test</h2>
              <p className="deck">Seven parts of the app are ready for you to poke at. Each row ends with the thing we most want checked.</p>
            </header>
            <ol className="tests">
              {TESTS.map((t, i) => (
                <li key={t.title} className="test pop" style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
                  <span className="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>
                    {t.title}
                    {t.fire && <Lottie name="fire" className="test-fire" />}
                  </h3>
                  <div>
                    <p>{t.body}</p>
                    <p className="try"><b>Try:</b> {t.test}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="block split" id="install">
            <header className="sec-head pop">
              <h2 className="big">Install guide</h2>
              <p className="deck">Three steps. The warning in step one is normal for any app that comes from outside Google Play.</p>
              <a className="btn" href={APK_URL}>
                <Download size={20} strokeWidth={2.5} /> Download APK <small>{VERSION}</small>
              </a>
              <p className="safe"><ShieldCheck size={18} strokeWidth={2.25} /> Hosted on our public GitHub release.</p>
            </header>
            <ol className="steps pop">
              {INSTALL.map((s, i) => (
                <li key={s.title} className="step" style={{ '--d': `${150 + i * 320}ms` } as CSSProperties}>
                  <span className="digit">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="block split" id="faq">
            <header className="sec-head pop">
              <h2 className="big">Questions</h2>
              <p className="deck">Answers for the things testers run into first.</p>
            </header>
            <div className="faq">
              {FAQ.map((f, i) => (
                <details key={f.q} className="pop" open={i === 0}>
                  <summary>
                    {f.q}
                    <span className="plus"><Plus size={18} strokeWidth={2.5} /></span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="finale" id="feedback">
            <div className="finale-in pop">
              <div>
                <h2 className="big">Found a bug? Tell us.</h2>
                <p className="lede">Every report from a tester makes the public release better. Screenshots help a lot.</p>
                <div className="cta">
                  <a className="btn" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
                    Send feedback <ExternalLink size={18} strokeWidth={2.5} />
                  </a>
                </div>
              </div>
              <div className="finale-art">
                <Lottie name="confetti" className="confetti" />
                <Lottie name="celebrate" label="EcoBud mascot celebrating" />
              </div>
            </div>
          </section>
        </main>

        <footer className="foot">
          <span>EcoBud {VERSION} beta</span>
          <span>&copy; {new Date().getFullYear()} EcoBud Project</span>
          <a href="#top">Back to top</a>
        </footer>
      </div>
    </>
  );
}
