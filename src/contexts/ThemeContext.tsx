import React, { createContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

export interface DarkModeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';

    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;

    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  useLayoutEffect(() => {
    // Symmetric toggle: garante que só uma das classes ('light' | 'dark') fique no
    // <html> por vez. Um toggle assimétrico (só mexendo em 'dark') pode deixar as duas
    // classes coexistindo se algo mais no documento já tiver aplicado 'light' antes
    // (ex.: este provider embutido dentro de um host que já gerencia sua própria
    // classList) — a classe 'dark' nunca seria removida nesse cenário.
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const saved = localStorage.getItem('theme');
      if (saved !== 'light' && saved !== 'dark') {
        setTheme(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.add('theme-switching');

    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    root.classList.toggle('dark', newTheme === 'dark');
    root.classList.toggle('light', newTheme === 'light');
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  };

  const contextValue = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <DarkModeContext.Provider value={contextValue}>{children}</DarkModeContext.Provider>;
}
