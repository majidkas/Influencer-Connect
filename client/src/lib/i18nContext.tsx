import React, { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { translations, Language, TranslationKey } from "./translations";
import type { Settings } from "@shared/schema";

interface I18nContextType {
  language: Language;
  t: (key: TranslationKey) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  // On récupère les settings depuis l'API pour savoir quelle langue utiliser
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: Infinity, // On évite de recharger trop souvent
  });

  const language = (settings?.language as Language) || "fr"; // Français par défaut si pas chargé

  // La fonction de traduction magique
  const t = (key: TranslationKey): string => {
    const text = translations[language][key];
    // Si la traduction manque, on affiche la clé ou la version anglaise en secours
    return text || translations["en"][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  );
}

// Le Hook personnalisé pour utiliser la traduction dans les composants
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}