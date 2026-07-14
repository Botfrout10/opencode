import { create } from 'zustand';

type Theme = 'dark' | 'light';

function initial(): Theme {
  const saved = localStorage.getItem('theme');
  return saved === 'dark' || saved === 'light' ? saved : 'dark';
}
function apply(t: Theme): void {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem('theme', t);
}

const initialTheme = initial();
apply(initialTheme);

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}
export const useTheme = create<ThemeState>((set) => ({
  theme: initialTheme,
  toggle: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      return { theme: next };
    }),
}));
