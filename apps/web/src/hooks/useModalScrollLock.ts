import { useEffect } from 'react';

/**
 * Hook to lock scrolling on document.body and an optional container element
 * when a modal or overlay is visible.
 */
export function useModalScrollLock(isOpen: boolean = true, containerId: string = 'admin-scroll-container') {
  useEffect(() => {
    if (!isOpen) return;

    const container = document.getElementById(containerId);
    const origContainerOverflow = container?.style.overflowY || '';
    const origBodyOverflow = document.body.style.overflow;

    if (container) container.style.overflowY = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      if (container) container.style.overflowY = origContainerOverflow;
      document.body.style.overflow = origBodyOverflow;
    };
  }, [isOpen, containerId]);
}
