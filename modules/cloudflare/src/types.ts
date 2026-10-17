import type { D1Database, Fetcher } from "@cloudflare/workers-types";

export type Category =
  | "runway"
  | "yarn"
  | "technology"
  | "market"
  | "sustainability";
export interface Source {
  id: string;
  name: string;
  url: string;
  region: string;
  language: string;
  category: Category;
  tier: "official" | "editorial";
  description: string;
  access: "open" | "mixed" | "subscription";
  collection: "rss" | "web" | "directory";
  feedUrl?: string;
  list?: {
    url: string;
    linkSelector: string;
    urlIncludes: string;
    containerSelector?: string;
    titleSelector?: string;
    summarySelector?: string;
    dateSelector?: string;
  };
  verifiedAt: string;
}
export interface Article {
  id: string;
  source_id: string;
  url: string;
  title: string;
  summary: string;
  category: Category;
  published_at: string | null;
  collected_at: string;
  relevance: number;
  date_kind: "published" | "discovered";
}
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  COLLECT_ENABLED: string;
}
