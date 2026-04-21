"""yfinance data service — quotes and financials."""

import yfinance as yf
from datetime import datetime, timezone, date
from typing import Optional
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


def get_quotes(tickers: list[str]) -> dict:
    """Batch fetch quotes for a list of tickers."""
    if not tickers:
        return {}

    results = {}
    try:
        data = yf.download(
            tickers,
            period="1d",
            progress=False,
            group_by="ticker",
            auto_adjust=True,
            threads=True,
        )
        # Also fetch YTD returns and market caps via Tickers
        ticker_objs = yf.Tickers(" ".join(tickers))

        # Get YTD start price
        ytd_data = yf.download(
            tickers,
            start=date(datetime.now().year, 1, 1).isoformat(),
            progress=False,
            group_by="ticker",
            auto_adjust=True,
            threads=True,
        )

        for ticker in tickers:
            try:
                t = ticker_objs.tickers[ticker]
                info = t.fast_info

                price = _safe_float(info.last_price)
                prev_close = _safe_float(info.previous_close)
                market_cap = _safe_float(info.market_cap)

                day_change_pct = None
                if price is not None and prev_close and prev_close != 0:
                    day_change_pct = (price - prev_close) / prev_close * 100

                # YTD return
                ytd_pct = None
                try:
                    if len(tickers) == 1:
                        ytd_close = ytd_data["Close"]
                    else:
                        ytd_close = ytd_data["Close"][ticker]
                    first_price = _safe_float(ytd_close.dropna().iloc[0]) if not ytd_close.dropna().empty else None
                    if first_price and price and first_price != 0:
                        ytd_pct = (price - first_price) / first_price * 100
                except Exception:
                    pass

                results[ticker] = {
                    "ticker": ticker,
                    "price": price,
                    "day_change_pct": day_change_pct,
                    "ytd_pct": ytd_pct,
                    "market_cap": market_cap,
                    "as_of": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                logger.warning("Quote fetch failed for %s: %s", ticker, e)
                results[ticker] = {"ticker": ticker, "error": str(e)}

    except Exception as e:
        logger.error("Batch quote fetch failed: %s", e)
        for ticker in tickers:
            results[ticker] = {"ticker": ticker, "error": str(e)}

    return results


def get_financials(ticker: str) -> dict:
    """Fetch quarterly financials and capex for a single ticker."""
    try:
        t = yf.Ticker(ticker)

        # Quarterly income statement
        qf = t.quarterly_financials
        # Quarterly cash flow
        qcf = t.quarterly_cashflow

        revenue_latest_q = None
        revenue_yoy_pct = None
        gross_margin = None
        capex_ttm = None
        capex_yoy_pct = None
        next_earnings_date = None

        if qf is not None and not qf.empty:
            # Revenue row
            rev_row = None
            for label in ["Total Revenue", "Revenue"]:
                if label in qf.index:
                    rev_row = qf.loc[label]
                    break

            if rev_row is not None:
                vals = rev_row.dropna()
                if len(vals) >= 1:
                    revenue_latest_q = _safe_float(vals.iloc[0])
                # YoY: compare same quarter last year (4 quarters back)
                if len(vals) >= 5:
                    prev = _safe_float(vals.iloc[4])
                    if prev and prev != 0 and revenue_latest_q:
                        revenue_yoy_pct = (revenue_latest_q - prev) / abs(prev) * 100

            # Gross margin
            gp_row = None
            for label in ["Gross Profit"]:
                if label in qf.index:
                    gp_row = qf.loc[label]
                    break
            if gp_row is not None and rev_row is not None:
                gp_vals = gp_row.dropna()
                rev_vals = rev_row.dropna()
                if len(gp_vals) >= 1 and len(rev_vals) >= 1:
                    gp = _safe_float(gp_vals.iloc[0])
                    rv = _safe_float(rev_vals.iloc[0])
                    if gp is not None and rv and rv != 0:
                        gross_margin = gp / rv * 100

        # Capex from cash flow
        if qcf is not None and not qcf.empty:
            capex_row = None
            for label in ["Capital Expenditure", "Purchase Of Property Plant And Equipment"]:
                if label in qcf.index:
                    capex_row = qcf.loc[label]
                    break

            if capex_row is not None:
                capex_vals = capex_row.dropna()
                # TTM = sum of last 4 quarters (capex is reported as negative)
                if len(capex_vals) >= 4:
                    capex_ttm = abs(_safe_float(capex_vals.iloc[:4].sum()) or 0)
                    # YoY: compare TTM vs prior 4 quarters
                    if len(capex_vals) >= 8:
                        prior_ttm = abs(_safe_float(capex_vals.iloc[4:8].sum()) or 0)
                        if prior_ttm and prior_ttm != 0:
                            capex_yoy_pct = (capex_ttm - prior_ttm) / prior_ttm * 100

        # Next earnings date
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
            "ticker": ticker,
            "revenue_latest_q": revenue_latest_q,
            "revenue_yoy_pct": revenue_yoy_pct,
            "gross_margin": gross_margin,
            "capex_ttm": capex_ttm,
            "capex_yoy_pct": capex_yoy_pct,
            "next_earnings_date": next_earnings_date,
        }
    except Exception as e:
        logger.error("Financials fetch failed for %s: %s", ticker, e)
        return {"ticker": ticker, "error": str(e)}
