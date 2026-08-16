export type HubKpiTrend = "up" | "down" | "neutral";

export type HubKpi = {
  label: string;
  value: string;
  change?: string;
  trend?: HubKpiTrend;
};

export type HubChartRow = {
  label: string;
  value: number;
};

export type HubAnalysisLink = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

export type HubAnalyticsPayload = {
  kpis: HubKpi[];
  chart?: {
    title: string;
    rows: HubChartRow[];
    format?: "number" | "currency";
  };
  currency?: string;
  /** Optional aging buckets for customers/purchasing AR/AP charts. */
  agingBuckets?: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
  agingTitle?: string;
  /** Drill links to reports / workflow screens. */
  analysisLinks?: HubAnalysisLink[];
};
