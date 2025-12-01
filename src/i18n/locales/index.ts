import { en } from "./en";
import type { TranslationMessages } from "./types";
import { zhCN } from "./zh-CN";
import { zhHK } from "./zh-HK";
import { zhTW } from "./zh-TW";

export type { TranslationKey, TranslationMessages } from "./types";

export type LocaleCode = "zh-CN" | "zh-TW" | "zh-HK" | "en";

export const translations: Record<LocaleCode, TranslationMessages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "zh-HK": zhHK,
};
