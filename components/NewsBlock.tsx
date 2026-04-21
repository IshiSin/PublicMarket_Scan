"use client";

import type { NewsItem } from "@/lib/types";

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "<1H";
  if (h < 24) return `${h}H`;
  return `${Math.floor(h / 24)}D`;
}

export default function NewsBlock({ news, error }: { news: NewsItem[]; error?: string }) {
  if (error) return (
    <div style={{ color: "var(--text-faint)", fontSize: "11px" }}>NEWS UNAVAILABLE</div>
  );
  if (!news?.length) return (
    <div style={{ color: "var(--text-faint)", fontSize: "11px" }}>NO RECENT NEWS</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {news.slice(0, 4).map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <span style={{
            color: "var(--text-faint)", fontSize: "10px", whiteSpace: "nowrap",
            paddingTop: "1px", minWidth: "24px",
          }}>
            {timeAgo(item.published_at)}
          </span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--text)",
              fontSize: "11px",
              lineHeight: "1.4",
              textDecoration: "none",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text)")}
          >
            {item.headline}
          </a>
        </div>
      ))}
    </div>
  );
}
