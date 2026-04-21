"""yfinance data service — quotes and financials."""

import yfinance as yf
from datetime import datetime, timezone, date
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

logger = logging.getLogger(__name__)


def _safe_float(val) -> Optional[float]:
    try:
        if val is None:
            return None
        f = float(val)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def _fetch_single_quote(ticker: str) -> dict:
    """Fetch quote for a single ticker using history (avoids fast_info rate limits)."""
    try:
        t = yf.Ticker(ticker)

        # Use history — hits a different Yahoo endpoint, less rate-limited
        hist = t.history(period="5d", auto_adjust=True)
        if hist.empty:
            raise ValueError("Empty history response")

        price      = _safe_float(hist["Close"].iloc[-1])
        prev_close = _safe_float(hist["Close"].iloc[-2]) if len(hist) >= 2 else None

        day_change_pct = None
        if price is not None and prev_close and prev_close != 0:
            day_change_pct = (price - prev_close) / prev_close * 100

        # Market cap from basic_info (lighter endpoint than fast_info)
        market_cap = None
        try:
            market_cap = _safe_float(getattr(t.basic_info, "market_cap", None))
        except Exception:
            pass

        # YTD return
        ytd_pct = None
        try:
            ytd_start = date(datetime.now().year, 1, 1).isoformat()
            ytd_hist  = t.history(start=ytd_start, auto_adjust=True)
            if not ytd_hist.empty and price:
                first = _safe_float(ytd_hist["Close"].dropna().iloc[0])
                if first and first != 0:
                    ytd_pct = (price - first) / first * 100
        except Exception:
            pass

        return {
            "ticker":         ticker,
            "price":          price,
            "day_change_pct": day_change_pct,
            "ytd_pct":        ytd_pct,
            "market_cap":     market_cap,
            "as_of":          datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.warning("Quote fetch failed for %s: %s", ticker, e)
        return {"ticker": ticker, "error": str(e)}


def get_quotes(tickers: list[str]) -> dict:
    """Fetch quotes for all tickers with limited concurrency to avoid rate limits."""
    if not tickers:
        return {}

    results = {}
    # 3 workers max — Yahoo throttles hard above this
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {ex.submit(_fetch_single_quote, t): t for t in tickers}
        for future in as_completed(futures):
            result = future.result()
            results[result["ticker"]] = result

    return results


def get_financials(ticker: str) -> dict:
    """Fetch quarterly financials and capex for a single ticker."""
    try:
        t = yf.Ticker(ticker)

        qf  = t.quarterly_financials
        qcf = t.quarterly_cashflow

        revenue_latest_q = None
        revenue_yoy_pct  = None
        gross_margin     = None
        capex_ttm        = None
        capex_yoy_pct    = None
        next_earnings_date = None

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
            "revenue_latest_q":  revenue_latest_q,
            "revenue_yoy_pct":   revenue_yoy_pct,
            "gross_margin":      gross_margin,
            "capex_ttm":         capex_ttm,
            "capex_yoy_pct":     capex_yoy_pct,
            "next_earnings_date": next_earnings_date,
        }
    except Exception as e:
        logger.error("Financials fetch failed for %s: %s", ticker, e)
        return {"ticker": ticker, "error": str(e)}
