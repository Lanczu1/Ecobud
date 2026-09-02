import {
  lightTheme,
  darkTheme,
  lightColors,
  darkColors,
  ThemeProvider,
  ThemeContext,
  useTheme,
  type ThemeMode,
  type ThemeColors,
  type EcoTheme,
} from './ThemeContext';

export {
  lightTheme,
  darkTheme,
  lightColors,
  darkColors,
  ThemeProvider,
  ThemeContext,
  useTheme,
  type ThemeMode,
  type ThemeColors,
  type EcoTheme,
};

// Default backward-compatible theme instance (Light mode by default)
export const ecoTheme = lightTheme;
