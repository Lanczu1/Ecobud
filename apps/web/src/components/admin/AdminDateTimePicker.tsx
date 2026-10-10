import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, useManilaNow } from '../../utils/manilaTime';

// Values are Asia/Manila wall time in the same shape a datetime-local input uses: YYYY-MM-DDTHH:mm.
// That shape sorts as text, so comparisons below are plain string comparisons.

const MINUTE_STEP = 5;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = (n: number) => String(n).padStart(2, '0');

function addMonths(day: string, amount: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m + amount, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + amount, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

function ceilToStep(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const [h, min] = value.slice(11, 16).split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, Math.ceil(min / MINUTE_STEP) * MINUTE_STEP)).toISOString().slice(0, 16);
}

function formatValue(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${value.length === 10 ? `${value}T00:00` : value}:00Z`).toLocaleString('en-PH', { timeZone: 'UTC', ...options });
}

interface AdminDateTimePickerProps {
  id: string;
  label: string;
  value: string;
  /** Earliest selectable moment. Days before it are disabled, and so are earlier times on that day. */
  min?: string;
  onChange: (value: string) => void;
}

const POPOVER_WIDTH = 336;
const selectClass = 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed';

export function AdminDateTimePicker({ id, label, value, min = '', onChange }: AdminDateTimePickerProps) {
  const today = useManilaNow().slice(0, 10);
  const minDay = min.slice(0, 10);
  const valueDay = value.slice(0, 10);

  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState(valueDay || minDay || today);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  const viewMonth = focusDay.slice(0, 7);
  const [viewYear, viewMonthNumber] = viewMonth.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(viewYear, viewMonthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonthNumber, 0)).getUTCDate();
  // Always six rows so the popover keeps one height while paging through months.
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - firstWeekday + 1;
    return dayNumber >= 1 && dayNumber <= daysInMonth ? `${viewMonth}-${pad(dayNumber)}` : null;
  });

  const openPicker = () => {
    const start = valueDay && valueDay >= minDay ? valueDay : minDay || today;
    setFocusDay(start);
    moveFocus.current = true;
    setOpen(true);
  };

  const closePicker = (returnFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
      const height = popoverRef.current?.offsetHeight ?? 0;
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPosition({ top, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      setPosition(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !position || !moveFocus.current) return;
    moveFocus.current = false;
    popoverRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${focusDay}"]`)?.focus();
  }, [open, position, focusDay]);

  const commit = (next: string) => onChange(min && next < min ? ceilToStep(min) : next);

  const selectDay = (day: string) => {
    setFocusDay(day);
    commit(`${day}T${value ? value.slice(11, 16) : '08:00'}`);
  };

  const goToMonth = (amount: number) => {
    const first = `${addMonths(`${viewMonth}-01`, amount).slice(0, 7)}-01`;
    setFocusDay(minDay && first < minDay ? minDay : first);
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const weekday = new Date(`${focusDay}T00:00:00Z`).getUTCDay();
    const moves: Record<string, string> = {
      ArrowLeft: addDays(focusDay, -1),
      ArrowRight: addDays(focusDay, 1),
      ArrowUp: addDays(focusDay, -7),
      ArrowDown: addDays(focusDay, 7),
      Home: addDays(focusDay, -weekday),
      End: addDays(focusDay, 6 - weekday),
      PageUp: addMonths(focusDay, -1),
      PageDown: addMonths(focusDay, 1),
    };
    const target = moves[e.key];
    if (!target) return;
    e.preventDefault();
    moveFocus.current = true;
    setFocusDay(minDay && target < minDay ? minDay : target);
  };

  const onPopoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePicker(true);
      return;
    }
    if (e.key !== 'Tab' || !popoverRef.current) return;
    const stops = Array.from(popoverRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)')).filter(el => el.tabIndex !== -1);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  // Time controls only limit options on the earliest allowed day. Later days are fully open.
  const timeLocked = !value || (!!minDay && valueDay < minDay);
  const onMinDay = !!min && valueDay === minDay;
  const minMinutes = min ? Number(min.slice(11, 13)) * 60 + Number(min.slice(14, 16)) : 0;
  const hour24 = value ? Number(value.slice(11, 13)) : 8;
  const minute = value ? Number(value.slice(14, 16)) : 0;
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;
  const to24 = (h12: number, pm: boolean) => (h12 % 12) + (pm ? 12 : 0);
  const setTime = (h: number, m: number) => commit(`${valueDay}T${pad(h)}:${pad(m)}`);
  const minuteOptions = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  if (!minuteOptions.includes(minute)) minuteOptions.push(minute);
  minuteOptions.sort((a, b) => a - b);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closePicker(false) : openPicker())}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors"
      >
        <Calendar className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-gray-500 dark:text-gray-400'}`}>
          {value ? formatValue(value, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Select date and time'}
        </span>
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onPopoverKeyDown}
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, width: position?.width ?? POPOVER_WIDTH, visibility: position ? 'visible' : 'hidden', maxHeight: 'calc(100vh - 16px)' }}
          className="fixed z-10000 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f1713] p-3.5 text-gray-900 dark:text-white shadow-xl focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => goToMonth(-1)} disabled={!!minDay && viewMonth <= minDay.slice(0, 7)} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p aria-live="polite" className="text-sm font-serif font-bold">{formatValue(`${viewMonth}-01`, { month: 'long', year: 'numeric' })}</p>
            <button type="button" onClick={() => goToMonth(1)} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-xs font-medium text-gray-500 dark:text-gray-400" aria-hidden="true">
            {WEEKDAYS.map(day => <span key={day} className="py-1.5">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5" onKeyDown={onGridKeyDown}>
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} className="aspect-square" />;
              const disabled = !!minDay && day < minDay;
              const selected = day === valueDay;
              const isToday = day === today;
              const tone = selected
                ? 'bg-green-700 text-white font-semibold'
                : disabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : isToday
                    ? 'ring-1 ring-inset ring-green-600 text-green-700 dark:text-green-400 font-semibold hover:bg-green-50 dark:hover:bg-green-950/40'
                    : 'text-gray-800 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-950/40';
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  disabled={disabled}
                  tabIndex={day === focusDay ? 0 : -1}
                  aria-label={formatValue(day, { month: 'long', day: 'numeric', year: 'numeric' })}
                  aria-pressed={selected}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => selectDay(day)}
                  className={`flex aspect-square w-full items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${tone} ${selected && disabled ? 'opacity-60' : ''}`}
                >
                  {Number(day.slice(8, 10))}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            <span className="mr-auto text-sm font-medium text-gray-700 dark:text-gray-300">Time</span>
            <select aria-label="Hour" disabled={timeLocked} value={hour12} onChange={e => setTime(to24(Number(e.target.value), isPm), minute)} className={selectClass}>
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
                <option key={h} value={h} disabled={onMinDay && to24(h, isPm) * 60 + 59 < minMinutes}>{h}</option>
              ))}
            </select>
            <select aria-label="Minute" disabled={timeLocked} value={minute} onChange={e => setTime(hour24, Number(e.target.value))} className={selectClass}>
              {minuteOptions.map(m => (
                <option key={m} value={m} disabled={onMinDay && hour24 * 60 + m < minMinutes}>{pad(m)}</option>
              ))}
            </select>
            <select aria-label="AM or PM" disabled={timeLocked} value={isPm ? 'PM' : 'AM'} onChange={e => setTime(to24(hour12, e.target.value === 'PM'), minute)} className={selectClass}>
              <option value="AM" disabled={onMinDay && minMinutes >= 720}>AM</option>
              <option value="PM">PM</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">Philippine time (UTC+8)</p>
            <button type="button" onClick={() => closePicker(true)} className="min-h-9 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0f1713] transition-colors">Done</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
