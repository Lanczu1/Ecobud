import { useEffect, useState } from 'react';

// Asia/Manila wall time in the shape a datetime-local input uses: YYYY-MM-DDTHH:mm.
export function manilaNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Manila' }).replace(' ', 'T').slice(0, 16);
}

export function useManilaNow(): string {
  const [now, setNow] = useState(manilaNow);
  useEffect(() => {
    const tick = () => setNow(manilaNow());
    const timer = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

export function addDays(day: string, amount: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + amount)).toISOString().slice(0, 10);
}
