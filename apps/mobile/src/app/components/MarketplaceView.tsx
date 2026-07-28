import React, { useState, useCallback } from 'react';
import { EcoBudMobileModel } from '../types/home';
import { MarketplaceHubView } from '../../features/giveAndGet/MarketplaceHubView';

export function MarketplaceView({
  model,
  onHideChrome,
}: {
  model: EcoBudMobileModel;
  onHideChrome?: (hidden: boolean) => void;
}) {
  const handleScreenStateChange = useCallback(
    (isSubScreen: boolean) => {
      onHideChrome?.(isSubScreen);
    },
    [onHideChrome],
  );

  return <MarketplaceHubView model={model} onScreenStateChange={handleScreenStateChange} />;
}
