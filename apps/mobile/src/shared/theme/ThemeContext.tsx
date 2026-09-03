import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { mobileStorage } from '../storage/mobileStorage';
import { typography, spacing } from '../../app/utils/responsive';

export type ThemeMode = 'light' | 'dark' | 'onyx';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  cardAlt: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  accentMuted: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSoft: string;
  border: string;
  outline: string;
  icon: string;
  iconMuted: string;
  inputBackground: string;
  inputBorder: string;
  cardBorder: string;
  badge: string;
  badgeText: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
  shadow: string;
  navBackground: string;
  navBorder: string;
  tabBarBackground: string;
  tabBarBorder: string;
  statusBar: 'light' | 'dark';
}

export interface EcoTheme {
  isDark: boolean;
  colors: ThemeColors;
  radius: {
    xl: number;
    lg: number;
    md: number;
    sm: number;
  };
  typography: typeof typography;
  spacing: typeof spacing;
}

const themeRadius = {
  xl: 36,
  lg: 24,
  md: 16,
  sm: 12,
};

export const lightColors: ThemeColors = {
  background: '#F7F9F7',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF6F1',
  card: '#FFFFFF',
  cardAlt: '#F0FDF4',
  primary: '#126027',
  primaryLight: '#4ADE80',
  primaryDark: '#0B4219',
  secondary: '#059669',
  accent: '#10B981',
  accentMuted: '#D4F7D4',
  text: '#1A211D',
  textPrimary: '#1A211D',
  textSecondary: '#4B5563',
  textMuted: '#6B7A75',
  textSoft: '#6B7A75',
  border: '#E5E9E7',
  outline: '#E5E9E7',
  icon: '#1A211D',
  iconMuted: '#6B7A75',
  inputBackground: '#F7FBF9',
  inputBorder: '#E6F4EC',
  cardBorder: '#E4F0E8',
  badge: '#F0F5F2',
  badgeText: '#126027',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  overlay: 'rgba(6, 27, 23, 0.52)',
  shadow: 'rgba(18, 96, 39, 0.08)',
  navBackground: '#F7F9F7',
  navBorder: '#E5E9E7',
  tabBarBackground: 'rgba(255, 255, 255, 0.98)',
  tabBarBorder: '#E2EBE5',
  statusBar: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#0B110E',
  surface: '#111A15',
  surfaceMuted: '#16221C',
  card: '#141E18',
  cardAlt: '#1A261F',
  primary: '#34D399',
  primaryLight: '#6EE7B7',
  primaryDark: '#10B981',
  secondary: '#10B981',
  accent: '#34D399',
  accentMuted: '#132E22',
  text: '#E4E9E6',
  textPrimary: '#F1F5F3',
  textSecondary: '#A8B3AE',
  textMuted: '#84918C',
  textSoft: '#74807C',
  border: '#233028',
  outline: '#233028',
  icon: '#E4E9E6',
  iconMuted: '#84918C',
  inputBackground: '#0D1411',
  inputBorder: '#233028',
  cardBorder: '#1E2B23',
  badge: '#17271F',
  badgeText: '#6EE7B7',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  overlay: 'rgba(0, 0, 0, 0.78)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  navBackground: '#0B110E',
  navBorder: '#233028',
  tabBarBackground: 'rgba(17, 26, 21, 0.98)',
  tabBarBorder: '#233028',
  statusBar: 'light',
};

export const onyxColors: ThemeColors = {
  ...darkColors,
  background: '#000000',
  surface: '#0A0A0A',
  surfaceMuted: '#121212',
  card: '#080808',
  cardAlt: '#0F0F0F',
  navBackground: '#000000',
  tabBarBackground: 'rgba(0, 0, 0, 0.98)',
};

export const lightTheme: EcoTheme = {
  isDark: false,
  colors: lightColors,
  radius: themeRadius,
  typography,
  spacing,
};

export const darkTheme: EcoTheme = {
  isDark: true,
  colors: darkColors,
  radius: themeRadius,
  typography,
  spacing,
};

export const onyxTheme: EcoTheme = {
  isDark: true,
  colors: onyxColors,
  radius: themeRadius,
  typography,
  spacing,
};

const THEME_STORAGE_KEY = 'ecobud_theme_mode';

interface ThemeContextValue {
  theme: EcoTheme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  themeMode: 'light',
  isDark: false,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  // Load persisted theme on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await mobileStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && (saved === 'light' || saved === 'dark' || saved === 'onyx')) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (err) {
        console.warn('Failed to load theme preference:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await mobileStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to persist theme preference:', err);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    let nextMode: ThemeMode = 'light';
    if (themeMode === 'light') nextMode = 'dark';
    else if (themeMode === 'dark') nextMode = 'onyx';
    await setThemeMode(nextMode);
  }, [themeMode, setThemeMode]);

  const isDark = themeMode === 'dark' || themeMode === 'onyx';
  const theme = useMemo(() => (themeMode === 'onyx' ? onyxTheme : isDark ? darkTheme : lightTheme), [isDark, themeMode]);

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      isDark,
      setThemeMode,
      toggleTheme,
    }),
    [theme, themeMode, isDark, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: lightTheme,
      themeMode: 'light',
      isDark: false,
      setThemeMode: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}
