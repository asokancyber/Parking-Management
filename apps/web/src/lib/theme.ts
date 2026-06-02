'use client';

import { useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'parksphere.theme';

// Hook for components that need to read / toggle the theme. The actual
// initial application happens via the inline script in layout.tsx (so the
// page paints in the chosen theme before React hydrates — no flash).
export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const [theme, setTheme] = useState<Theme>('dark');

  // Sync from DOM on mount (the inline script in layout.tsx has already
  // set the right attribute).
  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || 'dark';
    setTheme(current);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) apply(e.newValue as Theme, setTheme);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const set = useCallback((next: Theme) => apply(next, setTheme), []);
  const toggle = useCallback(() => set(theme === 'dark' ? 'light' : 'dark'), [theme, set]);

  return { theme, toggle, set };
}

function apply(next: Theme, setLocal: (t: Theme) => void) {
  document.documentElement.dataset.theme = next;
  try { window.localStorage.setItem(KEY, next); } catch { /* private mode */ }
  setLocal(next);
}

// The string we inline into <head>. Runs before hydration, so there's no
// dark-to-light flash on the first paint when a user has picked light.
export const NO_FLASH_SCRIPT = `
try {
  var t = localStorage.getItem('${KEY}') || 'dark';
  if (t !== 'light' && t !== 'dark') t = 'dark';
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}
`.trim();
