import { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';

type Props = {
  /** Folder under /lottie, produced by scripts/extract_lottie.py */
  name: 'mascot' | 'fire' | 'loading' | 'celebrate' | 'confetti';
  className?: string;
  label?: string;
  /** Load right away instead of waiting until it is near the viewport. */
  eager?: boolean;
};

const isLite = () => document.documentElement.classList.contains('lite');

/**
 * Plays one of the mobile app's Lottie animations.
 * The player is code-split, loads only when the element is close to the
 * screen, pauses when scrolled away, and shows a still frame in lite mode.
 */
export function Lottie({ name, className = '', label, eager = false }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let anim: AnimationItem | undefined;
    let visible = false;
    let cancelled = false;

    const sync = () => {
      if (!anim) return;
      if (visible && !document.hidden && !isLite()) anim.play();
      else anim.pause();
    };

    const load = async () => {
      const { default: lottie } = await import('lottie-web/build/player/lottie_light');
      if (cancelled) return;
      anim = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        path: `/lottie/${name}/data.json`,
        assetsPath: `/lottie/${name}/`,
        rendererSettings: { progressiveLoad: true, preserveAspectRatio: 'xMidYMid meet' },
      });
      anim.addEventListener('DOMLoaded', () => {
        el.classList.add('is-ready');
        // Frame 0 of the loading glyph is blank, so the still frame is taken mid-loop.
        if (isLite()) anim?.goToAndStop(Math.floor(anim.totalFrames / 2), true);
        sync();
      });
    };

    let started = eager;
    if (eager) void load();
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !started) {
          started = true;
          void load();
        }
        sync();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    document.addEventListener('visibilitychange', sync);

    return () => {
      cancelled = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      anim?.destroy();
    };
  }, [name, eager]);

  return (
    <div
      ref={box}
      className={`lottie lottie-${name} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
