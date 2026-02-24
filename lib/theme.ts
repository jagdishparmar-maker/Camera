import { MD3DarkTheme } from "react-native-paper";

// Reference: package tracking app dark theme
const primary = "#8CE02A"; // Vibrant lime green (accent)
const primaryContainer = "#5A8A1A"; // Darker lime
const secondary = "#E0C8FF"; // Muted light purple (for "Packed" style)
const surface = "#3A3A3C"; // Card/surface background
const background = "#2C2C2E"; // Main app background

export const appTheme = {
  ...MD3DarkTheme,
  dark: true,
  colors: {
    ...MD3DarkTheme.colors,
    primary,
    primaryContainer,
    onPrimary: "#1A1A1A",
    onPrimaryContainer: "#C8FF6A",
    secondary,
    secondaryContainer: "#5A3A8A",
    onSecondary: "#1A1A1A",
    onSecondaryContainer: "#E8D8FF",
    surface,
    surfaceVariant: "#48484A",
    background,
    onSurface: "#FFFFFF",
    onSurfaceVariant: "#C0C0C0",
    onBackground: "#FFFFFF",
    outline: "#636366",
    outlineVariant: "#48484A",
  },
  roundness: 16,
};
