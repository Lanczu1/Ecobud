import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { AnimationBounds, HomeAnimationVisibilityStore } from '../utils/homeAnimationVisibility';

export const HomeAnimationVisibilityContext = React.createContext<HomeAnimationVisibilityStore | null>(null);
const subscribeWithoutHome = () => () => {};

export function useHomeAnimationVisibility(trackViewport = false) {
  const store = React.useContext(HomeAnimationVisibilityContext);
  const { width, height } = useWindowDimensions();
  const viewRef = React.useRef<View>(null);
  const [bounds, setBounds] = React.useState<AnimationBounds | null>(null);
  const visible = React.useSyncExternalStore(
    store?.subscribe ?? subscribeWithoutHome,
    () => store?.isVisible(trackViewport ? bounds : undefined) ?? true,
    () => true,
  );
  const onLayout = React.useCallback(() => {
    if (!store || !trackViewport) return;
    viewRef.current?.measureInWindow((_x, y, _width, height) => {
      const next = store.captureBounds(y, height);
      setBounds(current => current?.top === next.top && current.height === next.height ? current : next);
    });
  }, [store, trackViewport]);
  React.useEffect(() => { onLayout(); }, [onLayout, width, height]);
  React.useEffect(() => {
    if (!store || !trackViewport || (bounds && bounds.height > 0)) return;
    return store.subscribe(onLayout);
  }, [store, trackViewport, bounds, onLayout]);
  return { managed: store !== null, visible, viewRef, onLayout };
}
