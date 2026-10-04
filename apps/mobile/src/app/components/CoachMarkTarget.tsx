import React, { useRef, useEffect, useCallback } from 'react';
import { View, ViewProps, LayoutChangeEvent } from 'react-native';
import { useScreenActive } from '../../shared/ui/ScreenActivity';

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface CoachMarkTargetProps extends ViewProps {
  name?: string;
  borderRadius?: number;
  active?: boolean;
  pollWhileActive?: boolean;
  measureRef?: React.RefObject<View | null>;
  onMeasure?: (rect: SpotlightRect) => void;
  children: React.ReactNode;
}

/**
 * Reusable CoachMarkTarget wrapper component.
 * Attaches a direct ref and measures its exact screen coordinates in-window
 * on layout, layout changes, window resize, or when requested.
 */
export const CoachMarkTarget = React.forwardRef<View, CoachMarkTargetProps>(
  ({ name, borderRadius, active = true, pollWhileActive = true, measureRef, onMeasure, style, children, onLayout, ...props }, forwardedRef) => {
    const internalRef = useRef<View | null>(null);
    const screenActive = useScreenActive();
    const screenActiveRef = useRef(screenActive);
    screenActiveRef.current = screenActive;

    const onMeasureRef = useRef(onMeasure);
    onMeasureRef.current = onMeasure;

    const lastRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

    const measureTarget = useCallback(() => {
      if (!screenActive) return;
      const target = measureRef?.current ?? internalRef.current;
      if (!target) return;
      target.measureInWindow((x, y, width, height) => {
        if (!screenActiveRef.current) return;
        if (width > 0 && height > 0) {
          const last = lastRectRef.current;
          // Avoid triggering redundant state updates if coordinates haven't changed
          if (
            last &&
            Math.abs(last.x - x) < 0.5 &&
            Math.abs(last.y - y) < 0.5 &&
            Math.abs(last.width - width) < 0.5 &&
            Math.abs(last.height - height) < 0.5
          ) {
            return;
          }
          lastRectRef.current = { x, y, width, height };
          onMeasureRef.current?.({
            x,
            y,
            width,
            height,
            borderRadius,
          });
        }
      });
    }, [borderRadius, measureRef, screenActive]);

    // Re-measure when target becomes active and settle smoothly without heavy bridge thrashing
    useEffect(() => {
      if (!active || !screenActive) {
        lastRectRef.current = null;
        return;
      }
      
      // Immediate measure via requestAnimationFrame for smooth native sync
      const raf = requestAnimationFrame(measureTarget);

      // Measure after layout & animations settle
      const timer1 = setTimeout(measureTarget, 80);
      const timer2 = setTimeout(measureTarget, 220);
      const timer3 = setTimeout(measureTarget, 450);
      const timer4 = setTimeout(measureTarget, 750);

      // Follow the target during auto-scroll when polling is enabled.
      const interval = pollWhileActive ? setInterval(measureTarget, 200) : null;

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        if (interval !== null) clearInterval(interval);
      };
    }, [active, screenActive, pollWhileActive, measureTarget]);

    const handleLayout = (e: LayoutChangeEvent) => {
      onLayout?.(e);
      if (active) {
        measureTarget();
      }
    };

    return (
      <View
        ref={(node) => {
          internalRef.current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        collapsable={false}
        onLayout={handleLayout}
        style={style}
        {...props}
      >
        {children}
      </View>
    );
  }
);

CoachMarkTarget.displayName = 'CoachMarkTarget';
