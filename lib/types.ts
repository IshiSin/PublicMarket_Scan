export type SubTheme =
  | "mag7"
  | "neoclouds"
  | "semis_compute"
  | "semis_fab_equipment"
  | "ai_applications"
  | "international";

export interface Company {
  ticker: string;
  name: string;
  sub_theme: SubTheme;
  exchange: string;
  cik: string;
  ir_url: string;
}

export interface Quote {
  ticker: string;
  price: number;
  day_change_pct: number;
  ytd_pct: number;
  market_cap?: number;
  as_of: string;
}

export interface Financials {
  ticker: string;
  revenue_annual: number | null;
  revenue_latest_q: number | null;
  revenue_yoy_pct: number | null;
  net_income_mrq: number | null;
  gross_margin: number | null;
  capex_ttm: number | null;
  capex_yoy_pct: number | null;
}

export interface NewsItem {
  ticker: string;
  headline: string;
  source: string;
  url: string;
  published_at: string;
}

export type TranscriptStatus = "pending" | "published" | "unavailable";

export interface AISummary {
  ai_revenue_mentions: string[];
  capex_guidance: string[];
  gpu_supply_commentary: string[];
  data_center_plans: string[];
  other_notable: string[];
}

export interface EarningsEvent {
  ticker: string;
  fiscal_quarter: string;
  report_date: string;
  eps_actual: number | null;
  eps_estimate: number | null;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  transcript_status: TranscriptStatus;
  transcript_source_url: string | null;
  transcript_added_at: string | null;
  ai_summary: AISummary | null;
  takeaways_md: string | null;
}

export interface CompanyData {
  company: Company;
  quote: Quote | null;
  financials: Financials | null;
  news: NewsItem[];
  events: EarningsEvent[];
  errors: {
    quote?: string;
    financials?: string;
    news?: string;
    events?: string;
  };
}
