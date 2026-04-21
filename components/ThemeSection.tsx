"use client";

import type { CompanyData, SubTheme } from "@/lib/types";
import { SUB_THEME_LABELS } from "@/lib/companies";
import CompanyCard from "./CompanyCard";

interface Props {
  theme: SubTheme;
  companies: CompanyData[];
}

export default function ThemeSection({ theme, companies }: Props) {
  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 border-b border-neutral-800 pb-2 mb-4">
        {SUB_THEME_LABELS[theme]}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {companies.map((d) => (
          <CompanyCard key={d.company.ticker} data={d} />
        ))}
      </div>
    </section>
  );
}
