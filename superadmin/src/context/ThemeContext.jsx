import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(undefined);
const THEME_KEY = 'theme';

export function ThemeProvider({ children }) {
  // What the user chose. This is the value that persists.
  const [preference, setPreference] = useState(() => localStorage.getItem(THEME_KEY) || 'light');

  // Set while a screen is mounted that must not follow the theme: the auth
  // pages, which render no toggle and whose glass card is designed against a
  // light backdrop. Lifting it is the whole mechanism - because dark mode
  // everywhere in this app hangs off the one class below, forcing light here
  // also covers the `:root.dark` variables in theme.css, the 77 `.dark` rules
  // in customAntd.css, the antd tokens in Localization, and the logo choice in
  // AuthModule, without any of them needing to know about the auth screen.
  const [forcedLight, setForcedLight] = useState(false);

  // The theme actually in effect, and what every useTheme() consumer reads.
  // It differs from the preference only while a screen has forced light.
  const theme = forcedLight ? 'light' : preference;

  // A layout effect, not a plain effect: it must land before the browser paints.
  // A dark-theme user signing in would otherwise see one frame of the light
  // dashboard, and this screen's own class would be applied a frame too late.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    // The preference is what persists, so a forced-light screen cannot
    // overwrite the user's own choice.
    localStorage.setItem(THEME_KEY, preference);
  }, [theme, preference]);

  const value = useMemo(
    () => ({
      theme,
      // Toggles the preference rather than the applied theme, so signing back in
      // returns the user to the theme they picked.
      toggleTheme: () => setPreference((current) => (current === 'light' ? 'dark' : 'light')),
      setForcedLight,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Context hooks intentionally live with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
