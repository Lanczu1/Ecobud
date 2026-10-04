import { useLiteMode } from '../performance/deviceTier';

export function useListPerformance() {
  return useLiteMode() ? reducedListProps : standardListProps;
}

const standardListProps = {};
const reducedListProps = {
  maxToRenderPerBatch: 3,
  windowSize: 3,
  updateCellsBatchingPeriod: 64,
};
