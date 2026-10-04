import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { AppTab, EcoBudMobileModel } from '../types/home';
import { retainTabs, warmTab, nextWarmTab } from '../utils/retainedTabs';
import { ScreenActivityContext } from '../../shared/ui/ScreenActivity';

type PageProps = {
  tab: AppTab;
  visible: boolean;
  exposed: boolean;
  model: EcoBudMobileModel;
  render: (tab: AppTab, model: EcoBudMobileModel) => React.ReactNode;
};

export const RetainedTabPage = React.memo(function RetainedTabPage({ tab, visible, exposed, model, render }: PageProps) {
  return <View style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0, zIndex: visible ? 1 : 0 }]}
    pointerEvents={visible && exposed ? 'auto' : 'none'}
    accessibilityElementsHidden={!visible || !exposed}
    importantForAccessibility={visible && exposed ? 'auto' : 'no-hide-descendants'}>
    <ScreenActivityContext.Provider value={visible && exposed}>
      {render(tab, model)}
    </ScreenActivityContext.Provider>
  </View>;
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
