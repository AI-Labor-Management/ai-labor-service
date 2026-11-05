import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';
const Preferences = createContext({
  theme: 'light' as Theme,
  toggleTheme: () => {},
  guideOpen: false,
  openGuide: () => {},
  closeGuide: () => {},
});
export function readPreference(key: string, fallback: string) {
  try {
    return localStorage.getItem(`ai-labor-ui/${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(`ai-labor-ui/${key}`, value);
  } catch {
    /* UI preferences can remain session-only. */
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    readPreference('theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') ===
    'dark'
      ? 'dark'
      : 'light',
  );
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    savePreference('theme', theme);
  }, [theme]);
  return (
    <Preferences.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
        guideOpen,
        openGuide: () => setGuideOpen(true),
        closeGuide: () => setGuideOpen(false),
      }}
    >
      {children}
    </Preferences.Provider>
  );
}
export const usePreferences = () => useContext(Preferences);
export function ThemeToggle() {
  const { theme, toggleTheme } = usePreferences();
  return (
    <button
      className="icon-button theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
      title={theme === 'light' ? '다크 모드' : '라이트 모드'}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} />
    </button>
  );
}
