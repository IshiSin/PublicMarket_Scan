"""FastAPI backend for AI Market Map — quotes, financials, news."""

import os
import logging
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from yfinance_service import get_quotes, get_financials
from news_service import get_news
from scrape_service import scrape_transcript
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Market Map Backend")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/quotes")
def quotes_endpoint(tickers: str = Query(..., description="Comma-separated tickers")):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        raise HTTPException(status_code=400, detail="No tickers provided")
    if len(ticker_list) > 50:
        raise HTTPException(status_code=400, detail="Max 50 tickers per request")
    return get_quotes(ticker_list)


@app.get("/financials")
def financials_endpoint(ticker: str = Query(...)):
    return get_financials(ticker.strip().upper())


@app.get("/financials/batch")
def financials_batch_endpoint(tickers: str = Query(..., description="Comma-separated tickers")):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        raise HTTPException(status_code=400, detail="No tickers provided")
    results = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(get_financials, t): t for t in ticker_list}
        for future in as_completed(futures):
            result = future.result()
            results[result["ticker"]] = result
    return results


@app.get("/news")
def news_endpoint(ticker: str = Query(...), name: str = Query(""), limit: int = Query(5, ge=1, le=20)):
    return get_news(ticker.strip().upper(), name=name.strip(), limit=limit)


@app.get("/news/batch")
def news_batch_endpoint(
    tickers: str = Query(..., description="Comma-separated tickers"),
    names: str = Query("", description="Comma-separated company names matching tickers order"),
    limit: int = Query(5, ge=1, le=20),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    name_list   = [n.strip() for n in names.split(",")] if names else []
    if not ticker_list:
        raise HTTPException(status_code=400, detail="No tickers provided")
    results = {}
    def fetch(ticker: str, name: str):
        return ticker, get_news(ticker, name=name, limit=limit)
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {
            ex.submit(fetch, t, name_list[i] if i < len(name_list) else ""): t
            for i, t in enumerate(ticker_list)
        }
        for future in as_completed(futures):
            ticker, items = future.result()
            results[ticker] = items
    return results


@app.get("/scrape")
def scrape_endpoint(url: str = Query(..., description="URL to scrape transcript from")):
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")
    return scrape_transcript(url)
