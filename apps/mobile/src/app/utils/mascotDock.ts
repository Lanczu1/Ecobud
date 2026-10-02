export type MascotDock = { side: 'left' | 'right'; verticalRatio: number };

export function parseMascotDock(raw: string | null | undefined): MascotDock | null {
  if (!raw) return null;
  try {
    const dock = JSON.parse(raw);
    if (!dock || (dock.side !== 'left' && dock.side !== 'right') || typeof dock.verticalRatio !== 'number' || !Number.isFinite(dock.verticalRatio)) return null;
    return { side: dock.side, verticalRatio: Math.max(0, Math.min(1, dock.verticalRatio)) };
  } catch { return null; }
}

export function resolveMascotPosition(fingerX: number, fingerY: number, width: number, height: number) {
  const side = fingerX < width / 2 ? 'left' : 'right';
  const row = fingerY < height / 3 ? 'top' : fingerY < height * 2 / 3 ? 'center' : 'bottom';
  return `${row}-${side}` as 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-right';
}

export function isMascotEdgeDrop(fingerX: number, width: number, size: number) {
  const threshold = size / 4;
  return fingerX <= threshold || fingerX >= width - threshold;
}

export function resolveMascotDock(fingerX: number, fingerY: number, width: number, size: number, minY: number, maxY: number): MascotDock {
  const range = Math.max(0, maxY - minY);
  return {
    side: fingerX < width / 2 ? 'left' : 'right',
    verticalRatio: range > 0 ? Math.max(0, Math.min(1, (fingerY - size / 2 - minY) / range)) : 0,
  };
}

export function getMascotDockCoordinates(dock: MascotDock, width: number, size: number, minY: number, maxY: number) {
  return {
    x: dock.side === 'left' ? 0 : Math.max(0, width - size),
    y: minY + Math.max(0, maxY - minY) * dock.verticalRatio,
  };
}
