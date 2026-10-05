import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Easing, StyleSheet, View } from 'react-native';import type { AppTab, EcoBudMobileModel } from '../types/home';
import { retainTabs, warmTab, nextWarmTab } from '../utils/retainedTabs';
import { ScreenActivityContext } from '../../shared/ui/ScreenActivity';
import { Animated } from '../../shared/accessibility/animations';
import { isLowEndDevice } from '../../shared/performance/deviceTier';
import { useTheme } from '../../shared/theme/ecoTheme';

type PageProps = {
  tab: AppTab;
  visible: boolean;
  exposed: boolean;
  model: EcoBudMobileModel;
  render: (tab: AppTab, model: EcoBudMobileModel) => React.ReactNode;
};

const fade = Easing.out(Easing.quad);

// A page that is being hidden keeps its last frame instead of rendering again,
// so a tab switch only pays for the page that is coming in.
const RetainedTabContent = React.memo(function RetainedTabContent({ tab, model, render }: Pick<PageProps, 'tab' | 'visible' | 'model' | 'render'>) {
  return <>{render(tab, model)}</>;
}, (_previous, next) => !next.visible);

export const RetainedTabPage = React.memo(function RetainedTabPage({ tab, visible, exposed, model, render }: PageProps) {
  const lite = isLowEndDevice();
  const { theme } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const duration = lite ? 140 : 260;
  // Cross-fade: the incoming page fades in on top while the outgoing page stays
  // put underneath, then drops out once the incoming page has covered it.
  useLayoutEffect(() => {
    const animation = visible
      ? Animated.timing(progress, { toValue: 1, duration, easing: fade, useNativeDriver: true, isInteraction: false })
      : Animated.timing(progress, { toValue: 0, duration: 1, delay: duration, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [visible, progress, duration]);
  return <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress, zIndex: visible ? 1 : 0, backgroundColor: theme.colors.background }]}
    pointerEvents={visible && exposed ? 'auto' : 'none'}
    accessibilityElementsHidden={!visible || !exposed}
    importantForAccessibility={visible && exposed ? 'auto' : 'no-hide-descendants'}>
    <ScreenActivityContext.Provider value={visible && exposed}>
      <RetainedTabContent tab={tab} visible={visible} model={model} render={render} />
    </ScreenActivityContext.Provider>
  </Animated.View>;
}, (previous, next) => !previous.visible && !next.visible);

export function RetainedTabHost({ model, limit, exposed, bottomInset = 0, render }: {
  model: EcoBudMobileModel;
  limit: number;
  exposed: boolean;
  bottomInset?: number;
  render: PageProps['render'];
}) {
  const [tabs, setTabs] = useState<AppTab[]>([model.activeTab]);
  const warmingAllowed = useRef(true);
  useEffect(() => {
    const subscription = AppState.addEventListener('memoryWarning', () => {
      warmingAllowed.current = false;
      setTabs(current => current.slice(-1));
    });
    return () => subscription.remove();
  }, []);
  const next = retainTabs(tabs, model.activeTab, limit);
  if (next !== tabs) setTabs(next);
  useEffect(() => {
    const target = nextWarmTab(next, limit);
    if (!target || !warmingAllowed.current || !exposed || model.isHydrating || AppState.currentState !== 'active') return;
    let alive = true;
    const warm = () => {
      if (alive && warmingAllowed.current && AppState.currentState === 'active') {
        setTabs(current => warmTab(current, model.activeTab, target, limit));
      }
    };
    if (typeof requestIdleCallback === 'function') {
      const idle = requestIdleCallback(warm);
      return () => { alive = false; cancelIdleCallback(idle); };
    }
    const timer = setTimeout(warm, 150);
    return () => { alive = false; clearTimeout(timer); };
  }, [next, model.activeTab, model.isHydrating, limit, exposed]);
  return <View style={{ flex: 1, marginBottom: bottomInset }}>{next.map(tab => <RetainedTabPage key={tab} tab={tab}
    visible={tab === model.activeTab} exposed={exposed} model={model} render={render} />)}</View>;
}
