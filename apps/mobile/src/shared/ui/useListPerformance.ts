import { useAccessibility } from '../accessibility/AccessibilityContext';

export function useListPerformance() {
  const { preferences } = useAccessibility();
  return preferences.performance ? reducedListProps : standardListProps;
}

const standardListProps = {};
const reducedListProps = {
  maxToRenderPerBatch: 3,
  windowSize: 3,
  updateCellsBatchingPeriod: 64,
};
