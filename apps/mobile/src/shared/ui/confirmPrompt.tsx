import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';

type ConfirmPrompt = Pick<React.ComponentProps<typeof ConfirmDialog>, 'title' | 'message' | 'confirmLabel' | 'icon'> & {
  onConfirm: () => void;
};

let present: ((prompt: ConfirmPrompt) => void) | null = null;

/** In-app replacement for a two-button Alert.alert. Needs <ConfirmPromptHost /> mounted once at the app root. */
export function showConfirmPrompt(prompt: ConfirmPrompt) {
  present?.(prompt);
}

export function ConfirmPromptHost() {
  const [prompt, setPrompt] = React.useState<ConfirmPrompt | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    present = next => { setPrompt(next); setVisible(true); };
    return () => { present = null; };
  }, []);

  // The last prompt stays mounted while hidden so its text does not blank out during the fade.
  if (!prompt) return null;
  return (
    <ConfirmDialog
      visible={visible}
      title={prompt.title}
      message={prompt.message}
      confirmLabel={prompt.confirmLabel}
      icon={prompt.icon}
      onCancel={() => setVisible(false)}
      onConfirm={() => { setVisible(false); prompt.onConfirm(); }}
    />
  );
}
