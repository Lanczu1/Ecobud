import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { adminGet } from '../../../utils/adminApi';
import { Skeleton } from './PageSkeletons';

export type DestinationKind = 'challenge' | 'event' | 'lesson';

/** Action types that open one specific record, and which kind of record each one needs. */
export const destinationKindFor: Record<string, DestinationKind | undefined> = {
  'View Eco Challenge': 'challenge',
  'View Eco Event': 'event',
  'View Learning Module': 'lesson',
};

type Option = { id: string; title: string; detail: string; unavailableReason: string | null };

const kindNames: Record<DestinationKind, { one: string; many: string }> = {
  challenge: { one: 'challenge', many: 'challenges' },
  event: { one: 'event', many: 'events' },
  lesson: { one: 'learning module', many: 'learning modules' },
};

const fieldClass = 'w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200';

interface Props {
  kind: DestinationKind;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Who will see the announcement, so the list can warn about records some of them cannot open. */
  targetAudience: string;
  barangays: string[];
  /** When residents first see the button, for scheduled announcements. */
  publishAt: string | null;
  disabled?: boolean;
}

/**
 * Lets an admin find the button's destination by title. The record id is stored, the title is shown, and a saved
 * destination that is deleted or no longer open to residents is reported, never swapped for another.
 */
export function AnnouncementDestinationPicker({ kind, value, onChange, targetAudience, barangays, publishAt, disabled }: Props) {
  const names = kindNames[kind];
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const audience = new URLSearchParams({ type: kind, targetAudience, barangays: barangays.join(',') });
  if (publishAt) audience.set('publishAt', publishAt);
  const audienceKey = audience.toString();

  // The saved destination, looked up by id so its title shows and its current state is checked.
  const [selected, setSelected] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; option?: Option }>({ status: value ? 'loading' : 'ready' });
  const [resolveAttempt, setResolveAttempt] = useState(0);
  useEffect(() => {
    if (!value) { setSelected({ status: 'ready' }); return; }
    let alive = true;
    setSelected(current => current.option?.id === value ? current : { status: 'loading' });
    const params = new URLSearchParams(audienceKey);
    params.set('id', value);
    adminGet<{ items: Option[] }>(`/admin/announcements/destinations?${params}`)
      .then(({ items }) => { if (alive) setSelected(items[0] ? { status: 'ready', option: items[0] } : { status: 'missing' }); })
      .catch(() => { if (alive) setSelected({ status: 'error' }); });
    return () => { alive = false; };
  }, [value, audienceKey, resolveAttempt]);

  // Searching, shown while no destination is chosen or the admin chose to replace it.
  const [searching, setSearching] = useState(!value);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<{ status: 'loading' | 'ready' | 'error'; items: Option[] }>({ status: 'loading', items: [] });
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!searching) return;
    let alive = true;
    setResults(current => ({ status: 'loading', items: current.items }));
    const timer = setTimeout(() => {
      const params = new URLSearchParams(audienceKey);
      if (term.trim()) params.set('search', term.trim());
      adminGet<{ items: Option[] }>(`/admin/announcements/destinations?${params}`)
        .then(({ items }) => { if (alive) { setResults({ status: 'ready', items }); setActive(0); } })
        .catch(() => { if (alive) setResults({ status: 'error', items: [] }); });
    }, term ? 250 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [searching, term, audienceKey, searchAttempt]);

  // Switching between challenge, event and module starts a fresh search for the new kind.
  useEffect(() => { setTerm(''); setSearching(!value); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(option: Option) {
    onChange(option.id);
    setSelected({ status: 'ready', option });
    setSearching(false);
    setOpen(false);
    setTerm('');
  }

  function startReplacing() {
    setSearching(true);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.items.length;
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); if (count) setActive(i => (i + 1) % count); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (count) setActive(i => (i - 1 + count) % count); }
    else if (event.key === 'Enter' && open && results.items[active]) { event.preventDefault(); choose(results.items[active]); }
    else if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      else if (value) { event.preventDefault(); event.stopPropagation(); setSearching(false); }
    }
  }

  const savedNotice = value && selected.status === 'missing'
    ? `The saved ${names.one} no longer exists. Choose another ${names.one} or turn off the action button.`
    : value && selected.status === 'error'
      ? `The saved ${names.one} could not be loaded.`
      : null;

  return (
    <div className="space-y-2">
      {value && !searching && (
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
          <div className="min-w-0 flex-1">
            {selected.status === 'loading' ? (
              <div role="status" aria-label={`Loading the selected ${names.one}`} className="space-y-1.5 py-0.5">
                <Skeleton className="h-3.5 w-48 max-w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : selected.option ? (
              <>
                <p className="text-xs font-semibold text-gray-900 dark:text-white break-words">{selected.option.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 break-words">{selected.option.detail}</p>
              </>
            ) : (
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Saved {names.one}</p>
            )}
          </div>
          <button type="button" disabled={disabled} onClick={startReplacing}
            className="shrink-0 min-h-8 px-2.5 text-xs font-semibold text-green-700 dark:text-green-300 rounded-md hover:bg-green-50 dark:hover:bg-green-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50">
            Change
          </button>
        </div>
      )}

      {savedNotice && !searching && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            {savedNotice}
            {selected.status === 'error' && (
              <button type="button" onClick={() => setResolveAttempt(n => n + 1)} className="ml-1.5 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">Retry</button>
            )}
          </span>
        </p>
      )}
      {value && !searching && selected.option?.unavailableReason && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{selected.option.unavailableReason}</span>
        </p>
      )}

      {searching && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && results.items[active] ? `${listId}-${results.items[active].id}` : undefined}
              aria-label={`Search ${names.many} by title`}
              disabled={disabled}
              value={term}
              onChange={e => { setTerm(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
              placeholder={`Search ${names.many} by title`}
              className={`${fieldClass} pl-8 ${value ? 'pr-8' : ''}`}
            />
            {value && (
              <button type="button" aria-label="Keep the current destination" onClick={() => { setSearching(false); setOpen(false); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-y-auto">
              {results.status === 'loading' && !results.items.length ? (
                <div role="status" aria-label={`Loading ${names.many}`} className="p-2 space-y-2">
                  {[0, 1, 2].map(i => <div key={i} className="space-y-1.5 px-1 py-1"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}
                </div>
              ) : results.status === 'error' ? (
                <p role="alert" className="p-3 text-xs text-red-700 dark:text-red-300">
                  Could not load {names.many}.
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setSearchAttempt(n => n + 1)} className="ml-1.5 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">Retry</button>
                </p>
              ) : results.items.length === 0 ? (
                <p className="p-3 text-xs text-gray-600 dark:text-gray-300">
                  {term.trim() ? `No ${names.many} match "${term.trim()}".` : `There are no ${names.many} yet.`}
                </p>
              ) : (
                <ul id={listId} role="listbox" aria-label={`${names.many} matching your search`} className="py-1">
                  {results.items.map((option, index) => (
                    <li
                      key={option.id}
                      id={`${listId}-${option.id}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => choose(option)}
                      onMouseEnter={() => setActive(index)}
                      className={`px-3 py-2 cursor-pointer ${index === active ? 'bg-green-50 dark:bg-green-950/40' : ''}`}
                    >
                      <p className="text-xs font-semibold text-gray-900 dark:text-white break-words">{option.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 break-words">{option.detail}</p>
                      {option.unavailableReason && (
                        <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300 break-words">{option.unavailableReason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
