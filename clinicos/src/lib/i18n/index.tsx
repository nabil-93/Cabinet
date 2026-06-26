"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { fr } from "./translations/fr";
import { de } from "./translations/de";

export type Lang = "fr" | "de";

const TRANSLATIONS: Record<Lang, typeof fr> = { fr, de };

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LangCtx>({ lang: "de", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    const saved = localStorage.getItem("clinicos_lang") as Lang | null;
    if (saved === "fr" || saved === "de") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("clinicos_lang", l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const keys = key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let val: any = TRANSLATIONS[lang];
      for (const k of keys) {
        val = val?.[k];
        if (val === undefined) break;
      }
      let result = typeof val === "string" ? val : key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return result;
    },
    [lang]
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
