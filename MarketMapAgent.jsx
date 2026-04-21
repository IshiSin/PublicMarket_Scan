/**
 * MarketMapAgent.jsx
 *
 * Single-file React market map agent for pre-seed VCs.
 * Requires: React 18+, Tailwind CSS (auto-injected via CDN if absent).
 *
 * Usage: default export <App /> into your React entry point,
 * or open index.html that imports this file via a bundler / Vite.
 */

import React, { useState, useEffect, useRef } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  'pre-seed': '#7F77DD',
  'seed':     '#7F77DD',
  'series-a': '#1D9E75',
  'series-b': '#1D9E75',
  'series-c': '#BA7517',
  'public':   '#BA7517',
  'unknown':  '#888780',
};

const TARGET_COLOR = '#D85A30';

const LOADING_MESSAGES = [
  'Searching for competitors...',
  'Pulling funding data...',
  'Mapping the landscape...',
  'Building your market map...',
];

// Prompt sent to Gemini — requests structured JSON describing the competitive landscape.
const buildPrompt = (name, desc) => `Research the competitive landscape for this company: ${name} — ${desc}.
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "market_title": "short label for this market",
  "x_axis": { "label": "axis name", "low": "left end label", "high": "right end label" },
  "y_axis": { "label": "axis name", "low": "bottom label", "high": "top label" },
  "competitors": [
    {
      "name": "string",
      "funding_usd": number (total raised in millions, 0 if unknown),
      "stage": "pre-seed|seed|series-a|series-b|series-c|public|unknown",
      "x": number (0-100 position on x axis),
      "y": number (0-100 position on y axis),
      "hq": "City, Country",
      "description": "one sentence"
    }
  ],
  "target_company": {
    "name": "string",
    "x": number,
    "y": number,
    "description": "one sentence"
  }
}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

const getStageColor = (stage) =>
  STAGE_COLORS[(stage || '').toLowerCase()] || '#888780';

const formatFunding = (usd) => {
  if (!usd || usd === 0) return 'Undisclosed';
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1).replace(/\.0$/, '')}bn`;
  return `$${Math.round(usd)}m`;
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const truncate = (str, n) => {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '\u2026' : str;
};

// ── Stage Pill ────────────────────────────────────────────────────────────────

function StagePill({ stage, isTarget }) {
  const bg    = isTarget ? TARGET_COLOR : getStageColor(stage);
  const label = isTarget ? 'target' : (stage || 'unknown');
  return (
    <span
      style={{ backgroundColor: bg }}
      className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-medium whitespace-nowrap"
    >
      {label}
    </span>
  );
}

// ── API Key Gate ─────────────────────────────────────────────────────────────
// State 0: shown first whenever no API key is stored in React state.

function ApiKeyGate({ onSave }) {
  const [key, setKey] = useState('');

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Market map agent</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your Gemini API key to get started.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Gemini API key
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && key.trim() && onSave(key.trim())}
            placeholder="AIzaSy..."
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-1.5 mb-5">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Get a free key at aistudio.google.com &rarr;
            </a>
          </div>
          <button
            onClick={() => key.trim() && onSave(key.trim())}
            disabled={!key.trim()}
            className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Input Form ────────────────────────────────────────────────────────────────
// State 1: company name + description entry.

function InputForm({ onSubmit, onChangeKey }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const ready = name.trim() && desc.trim();
  const go = () => ready && onSubmit(name.trim(), desc.trim());

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Market map agent</h1>
            <p className="text-sm text-gray-500 mt-1">Map your competitive landscape.</p>
          </div>
          <button
            onClick={onChangeKey}
            className="ml-4 mt-1 text-xs text-gray-400 hover:text-gray-600 underline shrink-0"
          >
            Change API key
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Company name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme AI"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              One-line description
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go()}
              placeholder="e.g. AI-powered legal review for SMBs"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={go}
            disabled={!ready}
            className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Generate market map
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Uses Google Search &mdash; takes ~15 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Loading Panel ─────────────────────────────────────────────────────────────
// State 2: cycling status messages while the API call runs.

function LoadingPanel({ onChangeKey }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LOADING_MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-white relative flex flex-col items-center justify-center px-4">
      <button
        onClick={onChangeKey}
        className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Change API key
      </button>
      <div className="w-8 h-8 rounded-full border-2 border-gray-900 border-t-transparent animate-spin mb-5" />
      <p className="text-sm font-medium text-gray-700">{LOADING_MESSAGES[idx]}</p>
      <p className="text-xs text-gray-400 mt-1.5">This usually takes about 15 seconds</p>
    </div>
  );
}

// ── Bubble Chart ──────────────────────────────────────────────────────────────
// State 3 (A): SVG scatter plot with bubble radius = sqrt(funding_usd), scaled 14–44 px.

const SVG_H    = 420;
const MARGIN   = { top: 24, right: 32, bottom: 58, left: 68 };
const MIN_R    = 14;
const MAX_R    = 44;
const TIP_W    = 238;
const TIP_PAD  = 13; // top + per-line vertical rhythm

function BubbleChart({ data }) {
  const wrapRef = useRef(null);
  const [w, setW]   = useState(800);
  const [tip, setTip] = useState(null); // { item, isTarget, x, y } in SVG coords

  // Track container width with ResizeObserver for responsive SVG.
  useEffect(() => {
    if (!wrapRef.current) return;
    setW(wrapRef.current.offsetWidth || 800);
    const ro = new ResizeObserver(([entry]) =>
      setW(entry.contentRect.width || 800)
    );
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const { competitors = [], target_company, x_axis = {}, y_axis = {} } = data;

  const plotW = Math.max(w - MARGIN.left - MARGIN.right, 100);
  const plotH = SVG_H - MARGIN.top - MARGIN.bottom;

  // Map 0–100 domain values to SVG pixel positions.
  const px = (v) => MARGIN.left + (clamp(v, 0, 100) / 100) * plotW;
  const py = (v) => MARGIN.top + plotH - (clamp(v, 0, 100) / 100) * plotH;

  // Scale bubble radius: r = sqrt(funding), linearly mapped to [MIN_R, MAX_R].
  const maxSqrt = Math.max(
    1,
    ...competitors.map((c) => Math.sqrt(Math.max(0, c.funding_usd || 0)))
  );
  const getR = (f) => {
    if (!f || f <= 0) return MIN_R;
    return MIN_R + (Math.sqrt(f) / maxSqrt) * (MAX_R - MIN_R);
  };

  // Tooltip helpers
  const onEnter = (e, item, isTarget) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ item, isTarget, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onMove = (e, item, isTarget) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ item, isTarget, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Build tooltip line list, then derive height and clamped position.
  const buildTipLines = (item, isTarget) => [
    { t: item.name, bold: true, size: 11 },
    !isTarget
      ? { t: `${item.stage || 'unknown'} \u00b7 ${formatFunding(item.funding_usd)}`, bold: false, size: 10 }
      : null,
    item.hq ? { t: item.hq, bold: false, size: 10 } : null,
    item.description ? { t: truncate(item.description, 44), bold: false, size: 10 } : null,
  ].filter(Boolean);

  const tipContent = tip ? (() => {
    const lines  = buildTipLines(tip.item, tip.isTarget);
    const tipH   = TIP_PAD + lines.length * 17;
    let tx = tip.x + 14;
    let ty = tip.y - tipH / 2;
    if (tx + TIP_W > w) tx = tip.x - TIP_W - 14;
    tx = clamp(tx, 4, w - TIP_W - 4);
    ty = clamp(ty, 4, SVG_H - tipH - 4);
    return { lines, tipH, tx, ty };
  })() : null;

  return (
    <div ref={wrapRef} className="w-full rounded-xl border border-gray-200 overflow-hidden bg-white">
      <svg width={w} height={SVG_H} style={{ display: 'block', userSelect: 'none' }}>

        {/* Plot area background */}
        <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="#f5f5f5" />

        {/* Subtle grid lines at 25 %, 50 %, 75 % on both axes */}
        {[25, 50, 75].map((p) => (
          <g key={p}>
            <line
              x1={px(p)} y1={MARGIN.top} x2={px(p)} y2={MARGIN.top + plotH}
              stroke="#e2e2e2" strokeWidth={1} strokeDasharray="4 3"
            />
            <line
              x1={MARGIN.left} y1={py(p)} x2={MARGIN.left + plotW} y2={py(p)}
              stroke="#e2e2e2" strokeWidth={1} strokeDasharray="4 3"
            />
          </g>
        ))}

        {/* Plot area border */}
        <rect
          x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH}
          fill="none" stroke="#d1d5db" strokeWidth={1}
        />

        {/* X-axis: edge labels + centre axis name */}
        <text x={MARGIN.left + 2}         y={MARGIN.top + plotH + 16} fontSize={10} fill="#9ca3af">
          {x_axis.low || ''}
        </text>
        <text x={MARGIN.left + plotW - 2} y={MARGIN.top + plotH + 16} fontSize={10} fill="#9ca3af" textAnchor="end">
          {x_axis.high || ''}
        </text>
        <text
          x={MARGIN.left + plotW / 2} y={MARGIN.top + plotH + 42}
          fontSize={11} fill="#6b7280" textAnchor="middle" fontWeight="600"
        >
          {x_axis.label || ''}
        </text>

        {/* Y-axis: edge labels + rotated axis name */}
        <text x={MARGIN.left - 8} y={MARGIN.top + plotH - 2} fontSize={10} fill="#9ca3af" textAnchor="end">
          {y_axis.low || ''}
        </text>
        <text x={MARGIN.left - 8} y={MARGIN.top + 10} fontSize={10} fill="#9ca3af" textAnchor="end">
          {y_axis.high || ''}
        </text>
        <text
          x={14} y={MARGIN.top + plotH / 2}
          fontSize={11} fill="#6b7280" textAnchor="middle" fontWeight="600"
          transform={`rotate(-90 14 ${MARGIN.top + plotH / 2})`}
        >
          {y_axis.label || ''}
        </text>

        {/* Competitor bubbles — rendered before target so target is always on top */}
        {competitors.map((c, i) => {
          const r  = getR(c.funding_usd);
          const cx = px(c.x);
          const cy = py(c.y);
          return (
            <g
              key={i}
              onMouseEnter={(e) => onEnter(e, c, false)}
              onMouseMove={(e)  => onMove(e, c, false)}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: 'default' }}
            >
              <circle cx={cx} cy={cy} r={r} fill={getStageColor(c.stage)} opacity={0.85} />
              <text
                x={cx} y={cy + r + 12}
                fontSize={9} fill="#4b5563" textAnchor="middle" pointerEvents="none"
              >
                {truncate(c.name, 14)}
              </text>
            </g>
          );
        })}

        {/* Target company — coral circle with bold ring, always rendered on top */}
        {target_company && (() => {
          const r  = 22;
          const cx = px(target_company.x);
          const cy = py(target_company.y);
          return (
            <g
              onMouseEnter={(e) => onEnter(e, target_company, true)}
              onMouseMove={(e)  => onMove(e, target_company, true)}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: 'default' }}
            >
              {/* Outer halo */}
              <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke={TARGET_COLOR} strokeWidth={1.5} opacity={0.28} />
              {/* Main bubble with white stroke (bold ring) */}
              <circle cx={cx} cy={cy} r={r} fill={TARGET_COLOR} stroke="white" strokeWidth={3} opacity={0.92} />
              <text
                x={cx} y={cy + r + 13}
                fontSize={9} fill="#374151" textAnchor="middle" fontWeight="600" pointerEvents="none"
              >
                {truncate(target_company.name, 14)}
              </text>
            </g>
          );
        })()}

        {/* Hover tooltip — clamped so it never overflows SVG edges */}
        {tip && tipContent && (() => {
          const { lines, tipH, tx, ty } = tipContent;
          return (
            <g pointerEvents="none">
              <rect
                x={tx} y={ty} width={TIP_W} height={tipH}
                rx={7} fill="white" stroke="#e5e7eb" strokeWidth={1}
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.10))' }}
              />
              {lines.map((l, i) => (
                <text
                  key={i}
                  x={tx + 10} y={ty + 14 + i * 17}
                  fontSize={l.size}
                  fontWeight={l.bold ? '600' : '400'}
                  fill={l.bold ? '#111827' : '#6b7280'}
                >
                  {l.t}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Competitor Table ──────────────────────────────────────────────────────────
// State 3 (B): sortable table; target company pinned to first row.

function CompetitorTable({ data }) {
  const [sortKey, setSortKey] = useState('funding_usd');
  const [sortDir, setSortDir] = useState('desc');

  const { competitors = [], target_company } = data;

  const toggleSort = (k) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const sorted = [...competitors].sort((a, b) => {
    let av = a[sortKey] ?? '';
    let bv = b[sortKey] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  // Show note when >50 % of competitors have no funding data.
  const undisclosed  = competitors.filter((c) => !c.funding_usd || c.funding_usd === 0).length;
  const showFundingNote = competitors.length > 3 && undisclosed / competitors.length > 0.5;

  const Th = ({ label, col, noSort }) => (
    <th
      onClick={() => !noSort && toggleSort(col)}
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide select-none whitespace-nowrap ${
        !noSort ? 'cursor-pointer hover:text-gray-800' : ''
      }`}
    >
      {label}
      {!noSort && (
        <span className="ml-1 font-normal text-gray-300">
          {sortKey === col ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
        </span>
      )}
    </th>
  );

  // Target company row is pinned at top.
  const targetRow = target_company
    ? { ...target_company, isTarget: true, funding_usd: null, hq: '\u2014', stage: '' }
    : null;
  const rows = targetRow ? [targetRow, ...sorted] : sorted;

  return (
    <div>
      {showFundingNote && (
        <p className="text-xs text-amber-600 mb-2.5 pl-0.5">
          Funding data may be incomplete &mdash; verify on Crunchbase.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm min-w-[580px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th label="Company"      col="name" />
              <Th label="Stage"        col="stage" />
              <Th label="Total raised" col="funding_usd" />
              <Th label="HQ"           col="hq" />
              <Th label="Notes"        col="description" noSort />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={row.isTarget ? { backgroundColor: '#fff5f2' } : {}}
                className={`border-b border-gray-100 last:border-b-0 ${
                  !row.isTarget ? 'hover:bg-gray-50' : ''
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {row.name}
                  {row.isTarget && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">(your company)</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StagePill stage={row.stage} isTarget={row.isTarget} />
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {row.isTarget ? '\u2014' : formatFunding(row.funding_usd)}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.hq || '\u2014'}</td>
                <td className="px-4 py-3 text-gray-500">{row.description || '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Results View ──────────────────────────────────────────────────────────────
// State 3: bubble chart + header bar + competitor table.

function ResultsView({ data, onNewSearch, onRefresh, onChangeKey }) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="min-h-screen bg-white relative">
      <button
        onClick={onChangeKey}
        className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600 underline z-10"
      >
        Change API key
      </button>

      <div className="max-w-6xl mx-auto px-4 pt-8 pb-12">
        {/* Section A — bubble chart */}
        <BubbleChart data={data} />

        {/* Header bar between chart and table (not sticky) */}
        <div className="flex items-center justify-between mt-5 mb-4">
          <h2 className="text-base font-semibold text-gray-900 truncate mr-4">
            {data.market_title || 'Market map'}
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onNewSearch}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              &larr; New search
            </button>
            <button
              onClick={onRefresh}
              className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Mobile-only table toggle (< 640 px) */}
        <div className="sm:hidden mb-3">
          <button
            onClick={() => setShowTable((s) => !s)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showTable ? 'Hide table' : 'View table'}
          </button>
        </div>

        {/* Section B — competitor table (hidden on mobile by default) */}
        <div className={showTable ? 'block' : 'hidden sm:block'}>
          <CompetitorTable data={data} />
        </div>
      </div>
    </div>
  );
}

// ── Error View ────────────────────────────────────────────────────────────────

function ErrorView({ message, rawText, onRetry, onChangeKey }) {
  return (
    <div className="min-h-screen bg-white relative flex items-center justify-center px-4">
      <button
        onClick={onChangeKey}
        className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Change API key
      </button>
      <div className="w-full max-w-xl">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-red-700 mb-1">Something went wrong</p>
          <p className="text-sm text-red-600 mb-4">{message}</p>
          {rawText && (
            <pre className="bg-white border border-red-100 rounded-lg p-3 text-xs text-gray-600 overflow-auto max-h-52 whitespace-pre-wrap font-mono mb-4">
              {rawText}
            </pre>
          )}
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
// Root component. All state lives here — no localStorage / sessionStorage.

export default function App() {
  const [apiKey,      setApiKey]      = useState('');
  const [view,        setView]        = useState('api-key'); // api-key | input | loading | results | error
  const [companyName, setCompanyName] = useState('');
  const [companyDesc, setCompanyDesc] = useState('');
  const [marketData,  setMarketData]  = useState(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [rawText,     setRawText]     = useState('');

  // Auto-inject Tailwind CDN for standalone / no-build usage.
  useEffect(() => {
    if (!document.querySelector('#tw-cdn')) {
      const s = document.createElement('script');
      s.id  = 'tw-cdn';
      s.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(s);
    }
  }, []);

  // ── Gemini API call ────────────────────────────────────────────────────────
  // The `google_search` tool enables Gemini to run live Google Search queries
  // during generation, grounding responses in real-time data (funding rounds,
  // HQ locations, company stages, etc.).
  //
  // Response shape: candidates[0].content.parts[0].text contains the JSON string.
  // We strip any accidental ```json / ``` fences before calling JSON.parse().
  const runQuery = async (name, desc) => {
    setView('loading');
    setErrorMsg('');
    setRawText('');

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tools: [{ google_search: {} }],
            contents: [{ role: 'user', parts: [{ text: buildPrompt(name, desc) }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(`API error: ${json?.error?.message || `HTTP ${res.status}`}`);
        setRawText(JSON.stringify(json, null, 2));
        setView('error');
        return;
      }

      // Extract the generated text from the Gemini response envelope.
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        setErrorMsg('No text returned. The response may have been blocked or filtered.');
        setRawText(JSON.stringify(json, null, 2));
        setView('error');
        return;
      }

      // Strip accidental markdown code fences (```json ... ```) before parsing.
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i,     '')
        .replace(/```\s*$/i,     '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        setErrorMsg("Couldn't parse response — the model returned invalid JSON.");
        setRawText(text);
        setView('error');
        return;
      }

      setMarketData(parsed);
      setView('results');
    } catch (err) {
      setErrorMsg(`Network error: ${err.message}`);
      setView('error');
    }
  };

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleSaveKey   = (k)         => { setApiKey(k); setView('input'); };
  const handleChangeKey = ()          => setView('api-key');
  const handleSubmit    = (name, desc) => { setCompanyName(name); setCompanyDesc(desc); runQuery(name, desc); };
  const handleRefresh   = ()          => runQuery(companyName, companyDesc);
  const handleNewSearch = ()          => setView('input');
  const handleRetry     = ()          => runQuery(companyName, companyDesc);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === 'api-key')
    return <ApiKeyGate onSave={handleSaveKey} />;

  if (view === 'input')
    return <InputForm onSubmit={handleSubmit} onChangeKey={handleChangeKey} />;

  if (view === 'loading')
    return <LoadingPanel onChangeKey={handleChangeKey} />;

  if (view === 'error')
    return (
      <ErrorView
        message={errorMsg}
        rawText={rawText}
        onRetry={handleRetry}
        onChangeKey={handleChangeKey}
      />
    );

  if (view === 'results' && marketData)
    return (
      <ResultsView
        data={marketData}
        onNewSearch={handleNewSearch}
        onRefresh={handleRefresh}
        onChangeKey={handleChangeKey}
      />
    );

  return null;
}
