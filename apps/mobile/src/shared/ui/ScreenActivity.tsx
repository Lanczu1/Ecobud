import React, { useContext } from 'react';
import { useAppActive } from '../accessibility/useAppActive';

export const ScreenActivityContext = React.createContext(true);

export function useScreenActive() {
  const visible = useContext(ScreenActivityContext);
  const foreground = useAppActive();
  return visible && foreground;
}
