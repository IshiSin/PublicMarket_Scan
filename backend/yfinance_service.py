"""yfinance data service — quotes and financials."""

import yfinance as yf
import tempfile
import os
from datetime import datetime, timezone, date
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Point TzCache at a writable temp dir to avoid the Render /opt/render/.cache conflict
_tz_cache_dir = os.path.join(tempfile.gettempdir(), "yfinance_tz_cache")
os.makedirs(_tz_cache_dir, exist_ok=True)
yf.set_tz_cache_location(_tz_cache_dir)


def _safe_float(val) -> Optional[float]:
    try:
        if val is None:
            return None
        f = float(val)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def get_quotes(tickers: list[str]) -> dict:
    """Fetch quotes for all tickers in one batch download — avoids per-ticker rate limits."""
    if not tickers:
        return {}

    results = {}
    try:
        # Single batch request for all price history — far less rate-limited than individual calls
        hist = yf.download(
            tickers,
            period="5d",
            auto_adjust=True,
            progress=False,
            threads=False,   # serial inside download; we're already batching
        )

        # With multiple tickers yf.download returns MultiIndex columns: (field, ticker)
        # With a single ticker it returns flat columns
        multi = len(tickers) > 1

        # YTD history in one shot
        ytd_start = date(datetime.now().year, 1, 1).isoformat()
        try:
            ytd_hist = yf.download(
                tickers,
                start=ytd_start,
                auto_adjust=True,
                progress=False,
                threads=False,
            )
        except Exception:
            ytd_hist = None

        for ticker in tickers:
            try:
                if multi:
                    closes = hist["Close"][ticker].dropna()
                else:
                    closes = hist["Close"].dropna()

                if closes.empty:
                    results[ticker] = {"ticker": ticker, "error": "no price data"}
                    continue

                price      = _safe_float(closes.iloc[-1])
                prev_close = _safe_float(closes.iloc[-2]) if len(closes) >= 2 else None

                day_change_pct = None
                if price is not None and prev_close and prev_close != 0:
                    day_change_pct = (price - prev_close) / prev_close * 100

                # Market cap — lightweight individual call, non-critical
                market_cap = None
                try:
                    t = yf.Ticker(ticker)
                    market_cap = _safe_float(getattr(t.basic_info, "market_cap", None))
                except Exception:
                    pass

                # YTD
                ytd_pct = None
                try:
                    if ytd_hist is not None and price:
                        if multi:
                            ytd_closes = ytd_hist["Close"][ticker].dropna()
                        else:
                            ytd_closes = ytd_hist["Close"].dropna()
                        if not ytd_closes.empty:
                            first = _safe_float(ytd_closes.iloc[0])
                            if first and first != 0:
                                ytd_pct = (price - first) / first * 100
                except Exception:
                    pass

                results[ticker] = {
                    "ticker":         ticker,
                    "price":          price,
                    "day_change_pct": day_change_pct,
                    "ytd_pct":        ytd_pct,
                    "market_cap":     market_cap,
                    "as_of":          datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                logger.warning("Quote parse failed for %s: %s", ticker, e)
                results[ticker] = {"ticker": ticker, "error": str(e)}

    except Exception as e:
        logger.error("Batch download failed: %s", e)
        for ticker in tickers:
            results[ticker] = {"ticker": ticker, "error": str(e)}

    return results


def get_financials(ticker: str) -> dict:
    """Fetch quarterly financials and capex for a single ticker."""
    try:
        t = yf.Ticker(ticker)

        qf  = t.quarterly_financials
        qcf = t.quarterly_cashflow

        revenue_annual   = None
        revenue_latest_q = None
        revenue_yoy_pct  = None
        net_income_mrq   = None
        gross_margin     = None
        pe_ratio         = None
        capex_ttm        = None
        capex_yoy_pct    = None
        next_earnings_date = None

        # Annual revenue (most recent fiscal year)
        try:
            af = t.financials  # annual income statement
            if af is not None and not af.empty:
                for label in ["Total Revenue", "Revenue"]:
                    if label in af.index:
                        annual_vals = af.loc[label].dropna()
                        if len(annual_vals) >= 1:
                            revenue_annual = _safe_float(annual_vals.iloc[0])
                        break
        except Exception:
            pass

        if qf is not None and not qf.empty:
            rev_row = None
            for label in ["Total Revenue", "Revenue"]:
                if label in qf.index:
                    rev_row = qf.loc[label]
                    break

            if rev_row is not None:
                vals = rev_row.dropna()
                if len(vals) >= 1:
                    revenue_latest_q = _safe_float(vals.iloc[0])
                if len(vals) >= 5:
                    prev = _safe_float(vals.iloc[4])
                    if prev and prev != 0 and revenue_latest_q:
                        revenue_yoy_pct = (revenue_latest_q - prev) / abs(prev) * 100

            for ni_label in ["Net Income", "Net Income Common Stockholders"]:
                if ni_label in qf.index:
                    ni_vals = qf.loc[ni_label].dropna()
                    if len(ni_vals) >= 1:
                        net_income_mrq = _safe_float(ni_vals.iloc[0])
                    break

            gp_row = None
            if "Gross Profit" in qf.index:
                gp_row = qf.loc["Gross Profit"]
            if gp_row is not None and rev_row is not None:
                gp_vals  = gp_row.dropna()
                rev_vals = rev_row.dropna()
                if len(gp_vals) >= 1 and len(rev_vals) >= 1:
                    gp = _safe_float(gp_vals.iloc[0])
                    rv = _safe_float(rev_vals.iloc[0])
                    if gp is not None and rv and rv != 0:
                        gross_margin = gp / rv * 100

        # Trailing P/E — precomputed by Yahoo, needs t.info (cached 24h so rate limits fine)
        try:
            info = t.info
            pe = info.get("trailingPE")
            if pe is not None:
                pe_ratio = _safe_float(pe)
        except Exception:
            pass

        if qcf is not None and not qcf.empty:
            capex_row = None
            for label in ["Capital Expenditure", "Purchase Of Property Plant And Equipment"]:
                if label in qcf.index:
                    capex_row = qcf.loc[label]
                    break

            if capex_row is not None:
                capex_vals = capex_row.dropna()
                if len(capex_vals) >= 4:
                    capex_ttm = abs(_safe_float(capex_vals.iloc[:4].sum()) or 0)
                    if len(capex_vals) >= 8:
                        prior_ttm = abs(_safe_float(capex_vals.iloc[4:8].sum()) or 0)
                        if prior_ttm and prior_ttm != 0:
                            capex_yoy_pct = (capex_ttm - prior_ttm) / prior_ttm * 100

        try:
            cal = t.calendar
            if cal is not None and "Earnings Date" in cal:
                ed = cal["Earnings Date"]
                if hasattr(ed, "__iter__") and not isinstance(ed, str):
                    ed = list(ed)
                    if ed:
                        ed = ed[0]
                if hasattr(ed, "isoformat"):
                    next_earnings_date = ed.isoformat()
                elif isinstance(ed, str):
                    next_earnings_date = ed
        except Exception:
            pass

        return {
            "ticker":            ticker,
            "revenue_annual":    revenue_annual,
            "revenue_latest_q":  revenue_latest_q,
            "revenue_yoy_pct":   revenue_yoy_pct,
            "net_income_mrq":    net_income_mrq,
            "gross_margin":      gross_margin,
            "pe_ratio":          pe_ratio,
            "capex_ttm":         capex_ttm,
            "capex_yoy_pct":     capex_yoy_pct,
            "next_earnings_date": next_earnings_date,
        }
    except Exception as e:
        logger.error("Financials fetch failed for %s: %s", ticker, e)
        return {"ticker": ticker, "error": str(e)}
