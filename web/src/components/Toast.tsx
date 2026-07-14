import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface ToastItem {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

let nextId = 0;
let listeners: Array<() => void> = [];
let toasts: ToastItem[] = [];

function emitChange() {
  for (const l of listeners) l();
}

export function toast(kind: 'success' | 'error', message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message }];
  emitChange();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitChange();
  }, 3500);
}

function useToasts(): [ToastItem[], (id: number) => void] {
  const [snap, setSnap] = useState(toasts);

  useEffect(() => {
    const listener = () => setSnap([...toasts]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const dismiss = (id: number) => {
    toasts = toasts.filter((t) => t.id !== id);
    emitChange();
  };

  return [snap, dismiss];
}

/** Render this once at the top of any view (or App). Idempotent - renders to a fixed portal. */
export function ToastContainer() {
  const [items, dismiss] = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all animate-toast-in ${
            t.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {t.kind === 'success' ? <Check size={16} /> : <X size={16} />}
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="ml-2 opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
