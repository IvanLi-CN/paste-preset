import type { TranslationKey } from "../i18n";

export function translateProcessingError(
  error: Error,
  t: (key: TranslationKey) => string,
): string {
  switch (error.message) {
    case "heic.unavailable":
      return t("error.heic.unavailable");
    case "heic.libraryFailed":
      return t("error.heic.libraryFailed");
    case "heic.convertFailed":
      return t("error.heic.convertFailed");
    case "heic.unexpectedResult":
      return t("error.heic.unexpectedResult");
    case "image.invalidDataUrl":
      return t("error.processing.invalidDataUrl");
    case "image.sourceReadTimeout":
      return t("error.processing.sourceReadTimeout");
    case "image.canvasContext":
      return t("error.processing.canvasContext");
    case "image.decodeFailed":
      return t("error.processing.decodeFailed");
    case "image.processingTimeout":
      return t("error.processing.timeout");
    case "image.tooLarge":
      return t("error.processing.tooLarge");
    case "image.exportFailed":
      return t("error.processing.exportFailed");
    default:
      if (error.message === "Unknown processing error") {
        return t("status.error.unknown");
      }
      return error.message || t("status.error.unknown");
  }
}
