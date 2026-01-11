export type Language = "en" | "fr";

export const translations = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.influencers": "Influencers",
    "nav.campaigns": "Campaigns",
    "nav.settings": "Settings",
    "nav.subtitle": "Track ROI",
    
    // Dashboard
    "dash.total_influencers": "Total Influencers",
    "dash.active_campaigns": "Active Campaigns",
    "dash.total_revenue": "Total Revenue",
    "dash.total_costs": "Total Costs",
    "dash.average_roas": "Average ROAS",
    "dash.campaign_performance": "Campaign Performance",
    
    // Common
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.create": "Create",
    "common.update": "Update",
    "common.delete": "Delete",
    "common.edit": "Edit",
  },
  fr: {
    // Navigation
    "nav.dashboard": "Tableau de bord",
    "nav.influencers": "Influenceurs",
    "nav.campaigns": "Campagnes",
    "nav.settings": "Paramètres",
    "nav.subtitle": "Suivi ROI",
    
    // Dashboard
    "dash.total_influencers": "Total Influenceurs",
    "dash.active_campaigns": "Campagnes Actives",
    "dash.total_revenue": "Revenu Total",
    "dash.total_costs": "Coûts Totaux",
    "dash.average_roas": "ROAS Moyen",
    "dash.campaign_performance": "Performance des Campagnes",
    
    // Common
    "common.loading": "Chargement...",
    "common.error": "Erreur",
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.create": "Créer",
    "common.update": "Mettre à jour",
    "common.delete": "Supprimer",
    "common.edit": "Éditer",
  }
};

export type TranslationKey = keyof typeof translations.en;