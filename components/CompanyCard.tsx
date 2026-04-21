"use client";

import type { CompanyData } from "@/lib/types";
import PriceBlock from "./PriceBlock";
import FinancialsBlock from "./FinancialsBlock";
import NewsBlock from "./NewsBlock";
import EarningsTimeline from "./EarningsTimeline";

interface Props {
  data: CompanyData;
}

export default function CompanyCard({ data }: Props) {
  const { company, quote, financials, news, events, errors } = data;

  return (
    <div className="border border-neutral-800 rounded-lg p-4 space-y-3 bg-neutral-900/40">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-white">{company.ticker}</span>
          <span className="text-xs text-neutral-500">{company.name}</span>
        </div>
        <span className="text-xs text-neutral-700 uppercase">{company.exchange}</span>
      </div>

      {/* Price */}
      <PriceBlock quote={quote} error={errors.quote} />

      {/* Financials */}
      <div>
        <div className="text-xs text-neutral-600 mb-1 uppercase tracking-wider">Financials</div>
        <FinancialsBlock financials={financials} error={errors.financials} />
      </div>

      {/* News */}
      <div>
        <div className="text-xs text-neutral-600 mb-1 uppercase tracking-wider">News</div>
        <NewsBlock news={news} error={errors.news} />
      </div>

      {/* Earnings */}
      <div>
        <div className="text-xs text-neutral-600 mb-1 uppercase tracking-wider">Earnings</div>
        <EarningsTimeline events={events} irUrl={company.ir_url} error={errors.events} />
      </div>
    </div>
  );
}
