import { useEffect, useState } from "react";
import { THEME_OPTIONS } from "../features/app/appConstants";
import {
  getSystemTheme,
  loadThemePreference,
  saveThemePreference,
} from "../features/app/appHelpers";

export function useThemePreference() {
  const [themePreference, setThemePreference] = useState(loadThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const resolvedTheme =
    themePreference === "system" ? systemTheme : themePreference;
  const selectedThemeLabel =
    THEME_OPTIONS.find((option) => option.value === themePreference)?.label ??
    "Escuro";
  const themeSummary =
    themePreference === "system"
      ? `Sistema (${systemTheme === "light" ? "claro" : "escuro"})`
      : selectedThemeLabel;

  useEffect(() => {
    saveThemePreference(themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const updateSystemTheme = (event) => {
      setSystemTheme(event.matches ? "light" : "dark");
    };

    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  return {
    resolvedTheme,
    themePreference,
    themeSummary,
    setThemePreference,
  };
}
