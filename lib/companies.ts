import companiesRaw from "@/data/companies.json";
import type { Company, SubTheme } from "./types";

export const companies: Company[] = companiesRaw as Company[];

export const SUB_THEME_LABELS: Record<SubTheme, string> = {
  hyperscalers: "Hyperscalers",
  neoclouds: "Neoclouds",
  semis_compute: "Semis — Compute",
  semis_fab_equipment: "Semis — Fab & Equipment",
  ai_applications: "AI Applications",
  international: "International",
};

export const SUB_THEME_ORDER: SubTheme[] = [
  "hyperscalers",
  "neoclouds",
  "semis_compute",
  "semis_fab_equipment",
  "ai_applications",
  "international",
];

export function groupByTheme(): Map<SubTheme, Company[]> {
  const map = new Map<SubTheme, Company[]>();
  for (const theme of SUB_THEME_ORDER) {
    map.set(theme, []);
  }
  for (const c of companies) {
    map.get(c.sub_theme)?.push(c);
  }
  return map;
}

export function getCompany(ticker: string): Company | undefined {
  return companies.find((c) => c.ticker === ticker);
}

export const ADR_TICKERS = new Set(["TSM", "ASML", "BABA", "BIDU"]);
