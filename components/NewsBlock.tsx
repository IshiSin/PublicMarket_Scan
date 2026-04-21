"use client";

import type { NewsItem } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  news: NewsItem[];
  error?: string;
}

export default function NewsBlock({ news, error }: Props) {
  if (error) {
    return (
      <div className="text-xs text-neutral-500 border border-neutral-800 rounded px-3 py-2">
        News unavailable
      </div>
    );
  }
  if (!news) {
    return (
      <div className="text-xs text-neutral-600 border border-neutral-800 rounded px-3 py-2 animate-pulse">
        Loading…
      </div>
    );
  }
  if (news.length === 0) {
    return (
      <div className="text-xs text-neutral-600 border border-neutral-800 rounded px-3 py-2">
        No recent news
      </div>
    );
  }

  return (
    <div className="border border-neutral-800 rounded px-3 py-2 space-y-1.5">
      {news.slice(0, 5).map((item, i) => (
        <div key={i} className="text-xs">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-200 hover:text-white transition-colors line-clamp-2 leading-snug"
          >
            {item.headline}
          </a>
          <div className="text-neutral-600 mt-0.5">
            {item.source} · {timeAgo(item.published_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
