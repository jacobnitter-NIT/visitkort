import { useSyncExternalStore } from "react";
import english from "./en.json";
export type Language = "da" | "en";
const publicPage = /^\/p\/[a-f0-9]{64}/.test(location.pathname);
let language: Language = publicPage
  ? "en"
  : localStorage.getItem("visitkort-language") === "en"
    ? "en"
    : "da";
const listeners = new Set<() => void>();
document.documentElement.lang = language;
export const getLanguage = () => language;
export function setLanguage(next: Language) {
  language = next;
  localStorage.setItem("visitkort-language", next);
  document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getLanguage);
}
export function tr(text: string): string {
  return language === "en"
    ? (english as Record<string, string>)[text] || text
    : text;
}
export function LanguagePicker() {
  const current = useLanguage();
  return (
    <div className="language-picker" role="group" aria-label="Language / Sprog">
      <button
        type="button"
        aria-label="Dansk"
        aria-pressed={current === "da"}
        onClick={() => setLanguage("da")}
      >
        DA
      </button>
      <button
        type="button"
        aria-label="English"
        aria-pressed={current === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}

export function trf(
  text: string,
  values: Record<string, string | number>,
): string {
  return tr(text).replace(/\{(\w+)\}/g, (original, key) =>
    String(values[key] ?? original),
  );
}
