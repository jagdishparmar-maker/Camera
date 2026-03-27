import { configureFonts, MD3DarkTheme } from "react-native-paper";

const geistFontConfig = {
  fontFamily: "Geist_400Regular",
  default: { fontFamily: "Geist_400Regular" },
  labelSmall: { fontFamily: "GeistMono_400Regular" },
  labelMedium: { fontFamily: "GeistMono_500Medium" },
  labelLarge: { fontFamily: "GeistMono_500Medium" },
  titleSmall: { fontFamily: "Geist_500Medium" },
  titleMedium: { fontFamily: "Geist_500Medium" },
  titleLarge: { fontFamily: "Geist_600SemiBold" },
  headlineSmall: { fontFamily: "Geist_600SemiBold" },
  headlineMedium: { fontFamily: "Geist_600SemiBold" },
  headlineLarge: { fontFamily: "Geist_700Bold" },
  displaySmall: { fontFamily: "Geist_700Bold" },
  displayMedium: { fontFamily: "Geist_700Bold" },
  displayLarge: { fontFamily: "Geist_700Bold" },
};

// Material Design 3 (Material You) color tokens
const primary = "#8CE02A"; // Vibrant lime green (accent)
const primaryContainer = "#5A8A1A"; // Darker lime
const secondary = "#E0C8FF"; // Muted light purple
const secondaryContainer = "#5A3A8A";
const tertiary = "#7DD3FC"; // Accent tertiary (MD3)
const tertiaryContainer = "#0C4A6E";
const surface = "#3A3A3C"; // Card/surface background
const background = "#2C2C2E"; // Main app background

export const appTheme = {
  ...MD3DarkTheme,
  version: 3,
  dark: true,
  fonts: configureFonts({ config: geistFontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary,
    primaryContainer,
    onPrimary: "#1A1A1A",
    onPrimaryContainer: "#C8FF6A",
    secondary,
    secondaryContainer,
    onSecondary: "#1A1A1A",
    onSecondaryContainer: "#E8D8FF",
    tertiary,
    tertiaryContainer,
    onTertiary: "#1A1A1A",
    onTertiaryContainer: "#BAE6FD",
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
