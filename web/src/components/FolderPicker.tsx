import { useState } from 'react';
import { api } from '../api/client';

interface FolderPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Path field with a native folder picker.
 *
 * The picker calls a server endpoint that opens the OS folder dialog on the
 * server machine (the user's machine for a local tool) and returns the real
 * absolute path, which is then filled into the input.
 */
export function FolderPicker({ value, onChange, placeholder, id }: FolderPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBrowse() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.selectFolder();
      if (res.path) onChange(res.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open folder dialog');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '/absolute/path/to/workspace'}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={handleBrowse}
          disabled={busy}
          className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {busy ? 'Opening…' : 'Browse…'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1 text-xs text-zinc-400">
        Opens a native folder dialog on this machine and fills in the selected absolute path.
      </p>
    </div>
  );
}
