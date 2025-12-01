import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { type LocaleCode, type TranslationKey, translations } from "./locales";

const LOCALE_STORAGE_KEY = "pastePreset.locale";

const SUPPORTED_LOCALES: LocaleCode[] = ["en", "zh-CN", "zh-TW", "zh-HK"];

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return SUPPORTED_LOCALES.includes(value as LocaleCode);
}

function mapBrowserLocaleToLocaleCode(
  input: string | null | undefined,
): LocaleCode | undefined {
  if (!input) {
    return undefined;
  }

  const normalized = input.toLowerCase().replace("_", "-");

  if (normalized.startsWith("en")) {
    return "en";
  }

  if (!normalized.startsWith("zh")) {
    return undefined;
  }

  if (normalized.includes("hk")) {
    return "zh-HK";
  }

  if (
    normalized.includes("hant") ||
    normalized.includes("-tw") ||
    normalized.includes("-mo")
  ) {
    return "zh-TW";
  }

  return "zh-CN";
}

function getStoredLocale(): LocaleCode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocaleCode(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors and fall back to detection
  }

  return undefined;
}

function detectInitialLocale(): LocaleCode {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLocale = getStoredLocale();
  if (storedLocale) {
    return storedLocale;
  }

  const candidates: string[] = [];

  if (typeof navigator !== "undefined") {
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }

    if (typeof navigator.language === "string") {
      candidates.push(navigator.language);
    }
  }

  for (const candidate of candidates) {
    const mapped = mapBrowserLocaleToLocaleCode(candidate);
    if (mapped) {
      return mapped;
    }
  }

  return "en";
}

type I18nProviderProps = {
  children: ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<LocaleCode>(() =>
    detectInitialLocale(),
  );

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);

    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors so locale still updates in memory
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      const localeMessages = translations[locale];
      const fallbackMessages = translations.en;

      if (localeMessages && key in localeMessages) {
        return localeMessages[key];
      }

      if (fallbackMessages && key in fallbackMessages) {
        return fallbackMessages[key];
      }

      // Return the key itself if nothing matches to make missing keys obvious
      return key;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
}

export function useTranslation() {
  const { t, locale, setLocale } = useI18n();

  return { t, locale, setLocale };
}
