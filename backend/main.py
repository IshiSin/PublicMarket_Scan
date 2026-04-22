"""FastAPI backend for AI Market Map — quotes, financials, news."""

import os
import logging
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from yfinance_service import get_quotes, get_financials
from news_service import get_news
from scrape_service import scrape_transcript

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


@app.get("/news")
def news_endpoint(ticker: str = Query(...), name: str = Query(""), limit: int = Query(5, ge=1, le=20)):
    return get_news(ticker.strip().upper(), name=name.strip(), limit=limit)


@app.get("/scrape")
def scrape_endpoint(url: str = Query(..., description="URL to scrape transcript from")):
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")
    return scrape_transcript(url)
