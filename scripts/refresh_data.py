"""Public daily data collector; no credentials or third-party packages needed."""
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
INDEX = [("^GSPC", "S&P 500"), ("^IXIC", "나스닥 종합"), ("^DJI", "다우 존스"), ("^RUT", "러셀 2000")]
ASSETS = [("^TNX", "미국 10년물 금리", "yield"), ("^VIX", "VIX 변동성 지수", "index"),
          ("CL=F", "WTI 근월물 선물", "usd"), ("GC=F", "금 근월물 선물", "usd"), ("BTC-USD", "비트코인", "usd")]

def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def number(value):
    if isinstance(value, (float, int)):
        return float(value) if math.isfinite(value) else None
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)([TBMK]?)", str(value or "").replace(",", "").replace("$", "").strip(), re.I)
    return float(match[1]) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[match[2].upper()] if match else None

def parse_chart(payload, symbol, name, kind="usd", now=None):
    chart = payload.get("chart", {})
    if chart.get("error") or not chart.get("result"):
        raise ValueError(f"{symbol}: chart unavailable")
    result = chart["result"][0]
    timezone = ZoneInfo(result["meta"].get("exchangeTimezoneName", "America/New_York"))
    today = (now or dt.datetime.now(dt.timezone.utc)).astimezone(timezone).date()
    indicators = result["indicators"]
    quote = indicators["quote"][0]
    closes, volumes = quote.get("close", []), quote.get("volume", [])
    adjusted = (indicators.get("adjclose") or [{}])[0].get("adjclose", closes)
    history = []
    for i, timestamp in enumerate(result.get("timestamp", [])):
        date = dt.datetime.fromtimestamp(timestamp, timezone).date()
        close = number(closes[i]) if i < len(closes) else None
        adj = number(adjusted[i]) if i < len(adjusted) else None
        # Conservatively exclude today's bar, including continuously traded assets.
        if date >= today or close is None or close <= 0:
            continue
        history.append({"date": date.isoformat(), "close": close,
                        "adjusted": adj if adj is not None and adj > 0 else close,
                        "volume": number(volumes[i]) if i < len(volumes) else None})
    history.sort(key=lambda p: p["date"])
    if len(history) < 2:
        raise ValueError(f"{symbol}: insufficient completed daily bars")
    last, previous = history[-1], history[-2]
    return {"symbol": symbol, "name": name, "kind": kind, "price": last["close"],
            "change": (last["close"] / previous["close"] - 1) * 100,
            "changePoints": last["close"] - previous["close"], "date": last["date"],
            "history": history[-64:],
            "monthReturn": (last["adjusted"] / history[-22]["adjusted"] - 1) * 100 if len(history) >= 22 else None,
            "newHigh": len(history) >= 253 and last["adjusted"] >= max(p["adjusted"] for p in history[-253:-1]),
            "highHistoryComplete": len(history) >= 253, "source": "Yahoo Finance"}

def get_chart(symbol, name, kind="usd"):
    cache = ROOT / "data" / "cache" / (hashlib.sha256(symbol.encode()).hexdigest() + ".json")
    if cache.exists() and time.time() - cache.stat().st_mtime < 6 * 3600:
        cached = json.loads(cache.read_text(encoding="utf-8"))
        cached.update(name=name, kind=kind)
        return cached
    # Nasdaq uses BRK/A and BRK/B; Yahoo uses BRK-A and BRK-B.
    yahoo_symbol = symbol.replace("/", "-")
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(yahoo_symbol, safe="")
    record = parse_chart(fetch(url + "?range=2y&interval=1d"), symbol, name, kind)
    cache.parent.mkdir(parents=True,exist_ok=True)
    cache.write_text(json.dumps(record,ensure_ascii=False,allow_nan=False),encoding="utf-8")
    return record

def screener():
    summary = fetch("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=1&offset=0").get("data") or {}
    total = number(summary.get("totalrecords"))
    if total is None or total <= 0:
        raise ValueError("Nasdaq totalrecords missing")
    # The table endpoint omits volume. The download endpoint includes the full universe and volume.
    data = fetch("https://api.nasdaq.com/api/screener/stocks?download=true").get("data") or {}
    rows = data.get("rows") or []
    if len(rows) != int(total):
        raise ValueError(f"Nasdaq incomplete download: {len(rows)}/{int(total)}")
    parsed, seen = [], set()
    for row in rows:
        symbol = row.get("symbol", "").strip()
        if not symbol or symbol in seen:
            raise ValueError("Nasdaq missing or duplicate symbol")
        seen.add(symbol)
        price, volume, cap = number(row.get("lastsale")), number(row.get("volume")), number(row.get("marketCap"))
        parsed.append({"symbol": symbol, "name": row.get("name") or symbol, "marketCap": cap,
                       "snapshotPrice": price, "snapshotVolume": volume,
                       "screenerAsOf": data.get("asOf") or summary.get("asof"),
                       "turnover": price * volume if price and volume is not None and volume >= 0 else None})
    return parsed

def main():
    out = {"schemaVersion": 1, "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
           "indices": [], "assets": [], "stocks": [], "leaders": [], "highs": [], "warnings": [],
           "universe": {"total": 0, "eligible": 0, "fetched": 0, "complete": False}}
    request_failed = False
    for symbol, name, kind, section in ([(s,n,"index","indices") for s,n in INDEX] + [(s,n,k,"assets") for s,n,k in ASSETS]):
        try:
            out[section].append(get_chart(symbol, name, kind))
        except Exception as error:
            request_failed = True
            out["warnings"].append(f"{symbol}: {error}")
        print(f"Daily series: {symbol}", flush=True)
    try:
        universe = screener()
        valid = [s for s in universe if s["turnover"] is not None]
        top = sorted(valid, key=lambda s:s["turnover"], reverse=True)[:10]
        if len(valid) != len(universe):
            out["warnings"].append(f"추정 거래대금: {len(universe)-len(valid)}종목 가격/거래량 누락. 유효 {len(valid)}종목 내 순위")
        eligible = [s for s in universe if s["marketCap"] is not None and s["marketCap"] >= 10e9]
        targets = {s["symbol"]:s for s in eligible + top}
        print(f"Nasdaq universe: {len(universe)}; fetching {len(targets)} histories", flush=True)
        fetched = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(get_chart,s["symbol"],s["name"]):s for s in targets.values()}
            for future in concurrent.futures.as_completed(futures):
                s = futures[future]
                try:
                    record = future.result()
                    record.update({k:s[k] for k in ("marketCap","turnover","snapshotPrice","snapshotVolume","screenerAsOf")})
                    fetched[s["symbol"]] = record
                except Exception as error:
                    request_failed = True
                    out["warnings"].append(f"{s['symbol']}: {error}")
                if len(fetched) and len(fetched) % 25 == 0:
                    print(f"Histories collected: {len(fetched)}/{len(targets)}", flush=True)
        out["stocks"] = [dict(fetched.get(s["symbol"]) or s, rank=i+1) for i,s in enumerate(top)]
        candidates = [fetched[s["symbol"]] for s in eligible if s["symbol"] in fetched]
        out["leaders"] = sorted([s for s in candidates if s["monthReturn"] is not None], key=lambda s:s["monthReturn"], reverse=True)[:10]
        out["highs"] = sorted([s for s in candidates if s["newHigh"]], key=lambda s:s["marketCap"], reverse=True)
        incomplete = sum(not s["highHistoryComplete"] for s in candidates)
        if incomplete:
            out["warnings"].append(f"52주 신고가: {incomplete}종목 이력 부족")
        missing_cap = sum(s["marketCap"] is None for s in universe)
        if missing_cap:
            out["warnings"].append(f"시가총액 미제공 {missing_cap}종목은 주도주/신고가 분석에서 제외")
        out["universe"] = {"total":len(universe),"eligible":len(eligible),"fetched":len(candidates),
                           "turnoverValid":len(valid),"complete":len(candidates)==len(eligible) and not incomplete and not missing_cap}
    except Exception as error:
        request_failed = True
        out["warnings"].append(f"Nasdaq: {error}")
    destination = ROOT / "data" / "market.json"
    if not (out["indices"] or out["assets"] or out["stocks"]) or (request_failed and destination.exists()):
        print("Refresh failed/partial; existing snapshot preserved.", file=sys.stderr)
        for warning in out["warnings"]:
            print(warning, file=sys.stderr)
        return 1
    destination.parent.mkdir(exist_ok=True)
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(out,ensure_ascii=False,allow_nan=False),encoding="utf-8")
    os.replace(temporary,destination)
    print(f"Saved {destination}; warnings={len(out['warnings'])}")
    return 1 if request_failed else 0

if __name__ == "__main__":
    sys.exit(main())
