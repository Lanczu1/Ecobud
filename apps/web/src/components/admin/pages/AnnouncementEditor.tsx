import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Bold, Italic, List, ListOrdered, Link } from 'lucide-react';

export function serializeContent(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (!(node instanceof HTMLElement)) return '';
  const children = () => Array.from(node.childNodes).map(serializeContent).join('');
  switch (node.tagName) {
    case 'BR': return '\n';
    case 'B': case 'STRONG': return `**${children()}**`;
    case 'I': case 'EM': return `*${children()}*`;
    case 'A': {
      const href = node.getAttribute('href') || '';
      return /^https?:\/\//i.test(href) ? `[${children()}](${href})` : children();
    }
    case 'UL': case 'OL':
      return '\n' + Array.from(node.children).map((li, i) => `${node.tagName === 'UL' ? '-' : `${i + 1}.`} ${Array.from(li.childNodes).map(serializeContent).join('').trim()}`).join('\n') + '\n';
    case 'P': case 'DIV': return children() + '\n';
    default: return children();
  }
}

export function AnnouncementEditor({ initialContent, onChange }: { initialContent: ReactNode; onChange: (text: string) => void }) {
  const initial = useRef(initialContent);
  const field = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState<Record<string, boolean>>({});
  function sync() {
    if (!field.current) return;
    const text = Array.from(field.current.childNodes).map(serializeContent).join('').replace(/\n+$/, '');
    onChange(text);
    setError(text.length > 20000 ? 'Content must be 20,000 characters or fewer.' : '');
    updateSelection();
  }
  function updateSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && field.current?.contains(selection.anchorNode) && field.current.contains(selection.focusNode)) {
      range.current = selection.getRangeAt(0).cloneRange();
      setActive(Object.fromEntries(['bold', 'italic', 'insertUnorderedList', 'insertOrderedList'].map(command => [command, document.queryCommandState(command)])));
    }
  }
  function execute(command: string, value?: string) {
    field.current?.focus();
    const selection = window.getSelection();
    if (range.current && field.current?.contains(range.current.commonAncestorContainer)) {
      selection?.removeAllRanges();
      selection?.addRange(range.current);
    }
    document.execCommand(command, false, value);
    sync();
  }
  return <>
    <div role="group" aria-label="Content formatting" className="flex flex-wrap gap-1 mb-2 p-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      {[
        { command: 'bold', label: 'Bold', Icon: Bold },
        { command: 'italic', label: 'Italic', Icon: Italic },
        { command: 'insertUnorderedList', label: 'Bullets', Icon: List },
        { command: 'insertOrderedList', label: 'Numbered', Icon: ListOrdered },
        { command: 'createLink', label: 'Link', Icon: Link },
      ].map(({ command, label, Icon }) => <button key={command} type="button" title={label} aria-pressed={command === 'createLink' ? linkOpen : !!active[command]} onMouseDown={e => e.preventDefault()} onClick={() => {
        if (command === 'createLink') { updateSelection(); setLinkOpen(!linkOpen); setUrl(''); }
        else execute(command);
      }} className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${active[command] ? 'bg-green-100 dark:bg-green-900' : 'hover:bg-white dark:hover:bg-gray-800'}`}><Icon className="w-4 h-4" aria-hidden="true" />{label}</button>)}
    </div>
    {linkOpen && <div className="flex flex-wrap gap-2 mb-2">
      <input autoFocus type="url" aria-label="Link URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800" />
      <button type="button" disabled={!/^https?:\/\/\S+$/i.test(url)} onClick={() => { execute('createLink', url); setLinkOpen(false); }} className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50">Apply link</button>
      <button type="button" onClick={() => { setLinkOpen(false); field.current?.focus(); }} className="px-3 py-2 text-sm">Cancel</button>
    </div>}
    <div ref={field} contentEditable suppressContentEditableWarning role="textbox" aria-label="Announcement content" aria-multiline="true" aria-required="true" onInput={sync} onKeyUp={updateSelection} onMouseUp={updateSelection} onBlur={updateSelection} onPaste={e => { e.preventDefault(); execute('insertText', e.clipboardData.getData('text/plain')); }} className="announcement-content w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 min-h-35 max-h-80 overflow-y-auto break-words">
      {initial.current}
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Select text to format it, or choose Bold or Italic before typing.</p>
  </>;
}
