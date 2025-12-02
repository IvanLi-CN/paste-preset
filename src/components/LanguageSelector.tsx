import { Icon } from "@iconify/react";
import { useState } from "react";
import { type LocaleCode, type TranslationKey, useI18n } from "../i18n";

type LanguageOption = {
  code: LocaleCode;
  icon: string;
  labelKey: TranslationKey;
};

const LANGUAGES: LanguageOption[] = [
  {
    code: "zh-CN",
    icon: "circle-flags:cn",
    labelKey: "language.zh-CN",
  },
  {
    code: "zh-TW",
    // Use a neutral language icon instead of a political flag
    icon: "mdi:translate",
    labelKey: "language.zh-TW",
  },
  {
    code: "zh-HK",
    icon: "circle-flags:hk",
    labelKey: "language.zh-HK",
  },
  {
    code: "en",
    icon: "circle-flags:us",
    labelKey: "language.en",
  },
] satisfies LanguageOption[];

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage =
    LANGUAGES.find((item) => item.code === locale) ?? LANGUAGES[0];

  const handleToggle = () => {
    setIsOpen((previous) => !previous);
  };

  const handleSelect = (code: LocaleCode) => {
    if (code === locale) {
      setIsOpen(false);
      return;
    }

    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div
      className={["dropdown dropdown-end", isOpen ? "dropdown-open" : ""].join(
        " ",
      )}
    >
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-2"
        aria-label={t("language.ariaLabel")}
        onClick={handleToggle}
      >
        <Icon icon={currentLanguage.icon} className="h-5 w-5 rounded-full" />
        <span className="hidden text-xs font-medium sm:inline">
          {t(currentLanguage.labelKey)}
        </span>
      </button>

      <ul className="menu menu-sm dropdown-content mt-2 w-40 rounded-box bg-base-100 p-1 shadow">
        {LANGUAGES.map((language) => {
          const isActive = language.code === locale;

          return (
            <li key={language.code}>
              <button
                type="button"
                className={isActive ? "active" : ""}
                onClick={() => handleSelect(language.code)}
              >
                <Icon icon={language.icon} className="h-4 w-4 rounded-full" />
                <span className="text-sm">{t(language.labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
