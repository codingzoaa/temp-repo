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
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
INDEX = [("^GSPC", "S&P 500"), ("^IXIC", "나스닥 종합"), ("^DJI", "다우 존스"), ("^RUT", "러셀 2000"), ("^SOX", "필라델피아 반도체")]
ASSETS = [("^VIX", "VIX 변동성 지수", "index"), ("CL=F", "WTI 근월물 선물", "usd"),
          ("GC=F", "금 근월물 선물", "usd"), ("BTC-USD", "비트코인", "usd")]
SECTORS = [("XLK","Technology"),("XLC","Communication"),("XLY","Consumer Discretionary"),
           ("XLF","Financials"),("XLI","Industrials"),("XLE","Energy"),("XLV","Health Care"),
           ("XLP","Consumer Staples"),("XLU","Utilities"),("XLB","Materials"),("XLRE","Real Estate")]

def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def fetch_text(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")

def number(value):
    if isinstance(value, (float, int)):
        return float(value) if math.isfinite(value) else None
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)([TBMK]?)", str(value or "").replace(",", "").replace("$", "").strip(), re.I)
    return float(match[1]) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[match[2].upper()] if match else None

def average(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None

def parse_chart(payload, symbol, name, kind="usd", now=None):
    chart = payload.get("chart", {})
    if chart.get("error") or not chart.get("result"):
        raise ValueError(f"{symbol}: chart unavailable")
    result = chart["result"][0]
    timezone = ZoneInfo(result["meta"].get("exchangeTimezoneName", "America/New_York"))
    local_now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(timezone)
    today = local_now.date()
    completed_today = symbol not in {"CL=F", "GC=F", "BTC-USD"} and local_now.hour >= 17
    indicators = result["indicators"]
    quote = indicators["quote"][0]
    closes, volumes = quote.get("close", []), quote.get("volume", [])
    adjusted = (indicators.get("adjclose") or [{}])[0].get("adjclose", closes)
    history = []
    for i, timestamp in enumerate(result.get("timestamp", [])):
        date = dt.datetime.fromtimestamp(timestamp, timezone).date()
        close = number(closes[i]) if i < len(closes) else None
        adj = number(adjusted[i]) if i < len(adjusted) else None
        if date > today or (date == today and not completed_today) or close is None or close <= 0:
            continue
        history.append({"date": date.isoformat(), "close": close,
                        "adjusted": adj if adj is not None and adj > 0 else close,
                        "volume": number(volumes[i]) if i < len(volumes) else None})
    history.sort(key=lambda p: p["date"])
    if len(history) < 2:
        raise ValueError(f"{symbol}: insufficient completed daily bars")
    last, previous = history[-1], history[-2]
    adjusted_values = [p["adjusted"] for p in history]
    def above_ma(window):
        return len(adjusted_values) >= window and last["adjusted"] > average(adjusted_values[-window:])
    return {"symbol": symbol, "name": name, "kind": kind, "price": last["close"],
            "change": (last["close"] / previous["close"] - 1) * 100,
            "changePoints": last["close"] - previous["close"], "date": last["date"],
            "history": history[-253:],
            "monthReturn": (last["adjusted"] / history[-22]["adjusted"] - 1) * 100 if len(history) >= 22 else None,
            "weekReturn": (last["adjusted"] / history[-6]["adjusted"] - 1) * 100 if len(history) >= 6 else None,
            "newHigh": len(history) >= 253 and last["adjusted"] >= max(p["adjusted"] for p in history[-253:-1]),
            "newLow": len(history) >= 253 and last["adjusted"] <= min(p["adjusted"] for p in history[-253:-1]),
            "above20": above_ma(20), "above50": above_ma(50), "above200": above_ma(200),
            "highHistoryComplete": len(history) >= 253, "source": "Yahoo Finance"}

def get_chart(symbol, name, kind="usd"):
    local_now = dt.datetime.now(ZoneInfo("America/New_York"))
    session_key = f"{local_now.date()}:{local_now.hour >= 17}:v3"
    cache = ROOT / "data" / "cache" / (hashlib.sha256(symbol.encode()).hexdigest() + ".json")
    if cache.exists() and time.time() - cache.stat().st_mtime < 6 * 3600:
        cached = json.loads(cache.read_text(encoding="utf-8"))
        if cached.get("sessionKey") == session_key:
            cached.update(name=name, kind=kind)
            return cached
    yahoo_symbol = symbol.replace("/", "-")
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(yahoo_symbol, safe="")
    record = parse_chart(fetch(url + "?range=2y&interval=1d"), symbol, name, kind)
    record["sessionKey"] = session_key
    cache.parent.mkdir(parents=True,exist_ok=True)
    cache.write_text(json.dumps(record,ensure_ascii=False,allow_nan=False),encoding="utf-8")
    return record

def treasury_rates(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    year = now.year
    url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
           f"?data=daily_treasury_yield_curve&field_tdr_date_value={year}")
    root = ET.fromstring(fetch_text(url))
    rows = []
    for entry in root.iter():
        if entry.tag.rsplit("}",1)[-1] != "entry":
            continue
        values = {}
        for node in entry.iter():
            key = node.tag.rsplit("}",1)[-1]
            if node.text:
                values[key] = node.text.strip()
        raw_date = values.get("NEW_DATE") or values.get("Date")
        y2, y10 = number(values.get("BC_2YEAR")), number(values.get("BC_10YEAR"))
        if not raw_date or y2 is None or y10 is None:
            continue
        try:
            date = dt.datetime.fromisoformat(raw_date.replace("Z","+00:00")).date().isoformat()
        except ValueError:
            continue
        rows.append({"date":date,"y2":y2,"y10":y10,"spread":y10-y2})
    rows.sort(key=lambda r:r["date"])
    if len(rows) < 2:
        raise ValueError("Treasury yield curve history unavailable")
    def series(key, name):
        hist=[{"date":r["date"],"close":r[key]} for r in rows[-64:]]
        return {"symbol":key.upper(),"name":name,"kind":"yield","price":hist[-1]["close"],
                "change":hist[-1]["close"]-hist[-2]["close"],"changePoints":hist[-1]["close"]-hist[-2]["close"],
                "date":hist[-1]["date"],"history":hist,"source":"U.S. Treasury"}
    return {"twoYear":series("y2","미국 2년물 금리"),"tenYear":series("y10","미국 10년물 금리"),
            "spread":series("spread","10Y-2Y 금리차")}

def screener():
    summary = fetch("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=1&offset=0").get("data") or {}
    total = number(summary.get("totalrecords"))
    if total is None or total <= 0:
        raise ValueError("Nasdaq totalrecords missing")
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
                       "sector": (row.get("sector") or "미분류").strip(), "industry": (row.get("industry") or "").strip(),
                       "screenerAsOf": data.get("asOf") or summary.get("asof"),
                       "turnover": price * volume if price and volume is not None and volume >= 0 else None})
    return parsed

def build_breadth(candidates):
    measured = [s for s in candidates if s.get("change") is not None]
    def pct(key, window):
        eligible=[s for s in candidates if len(s.get("history",[])) >= window]
        return 100 * sum(bool(s.get(key)) for s in eligible) / len(eligible) if eligible else None
    return {"scope":"시총 $10B 이상 미국 종목","count":len(candidates),"advancers":sum(s["change"]>0 for s in measured),
            "decliners":sum(s["change"]<0 for s in measured),"unchanged":sum(s["change"]==0 for s in measured),
            "above20":pct("above20",20),"above50":pct("above50",50),"above200":pct("above200",200),
            "newHighs":sum(bool(s.get("newHigh")) for s in candidates),"newLows":sum(bool(s.get("newLow")) for s in candidates)}

def build_regime(out):
    by_symbol={s["symbol"]:s for s in out["indices"]}
    sox=by_symbol.get("^SOX"); nasdaq=by_symbol.get("^IXIC")
    vix=next((s for s in out["assets"] if s["symbol"]=="^VIX"),None)
    breadth=out.get("breadth") or {}
    signals=[]
    if nasdaq: signals.append({"name":"Nasdaq","positive":nasdaq["change"]>0,"value":nasdaq["change"]})
    if sox: signals.append({"name":"SOX","positive":sox["change"]>0,"value":sox["change"]})
    if vix: signals.append({"name":"VIX","positive":vix["change"]<0,"value":vix["change"]})
    if breadth.get("advancers") is not None:
        signals.append({"name":"Breadth","positive":breadth["advancers"]>=breadth["decliners"],
                        "value":breadth["advancers"]-breadth["decliners"]})
    if breadth.get("above50") is not None:
        signals.append({"name":">50DMA","positive":breadth["above50"]>=55,"value":breadth["above50"]})
    score=sum(s["positive"] for s in signals)
    ratio=score/len(signals) if signals else .5
    label="RISK ON" if ratio>=.7 else "RISK OFF" if ratio<=.3 else "NEUTRAL"
    tone="positive" if label=="RISK ON" else "negative" if label=="RISK OFF" else "neutral"
    y10=(out.get("rates") or {}).get("tenYear")
    if sox and y10 and sox["change"]>0 and y10["change"]>0:
        summary="반도체 강세가 장기금리 상승 부담을 소화하는 성장 주도 장세입니다."
    elif sox and y10 and sox["change"]<0 and y10["change"]>0:
        summary="장기금리 상승과 반도체 약세가 겹쳐 성장주 밸류에이션 부담이 커진 구간입니다."
    elif label=="RISK ON":
        summary="주가·변동성·시장 폭이 전반적으로 위험선호 방향을 가리킵니다."
    elif label=="RISK OFF":
        summary="주가와 시장 폭이 약하고 방어적 흐름이 우세합니다."
    else:
        summary="위험선호와 금리·변동성 신호가 엇갈리는 혼조 구간입니다."
    return {"label":label,"tone":tone,"score":score,"maxScore":len(signals),"summary":summary,"signals":signals}

def main():
    out = {"schemaVersion": 2, "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
           "indices": [], "assets": [], "rates": {}, "sectors": [], "breadth": {}, "regime": {},
           "stocks": [], "leaders": [], "highs": [], "warnings": [],
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
        out["rates"]=treasury_rates()
    except Exception as error:
        out["warnings"].append(f"Treasury: {error}")
    for symbol,name in SECTORS:
        try:
            record=get_chart(symbol,name)
            out["sectors"].append({"symbol":symbol,"name":name,"date":record["date"],"change":record["change"],
                                   "weekReturn":record["weekReturn"],"monthReturn":record["monthReturn"]})
        except Exception as error:
            out["warnings"].append(f"{symbol}: {error}")
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
                    record.update({"sector":s.get("sector") or "미분류", "industry":s.get("industry") or ""})
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
        out["breadth"] = build_breadth(candidates)
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
    out["regime"]=build_regime(out)
    destination = ROOT / "data" / "market.json"
    if not (out["indices"] or out["assets"] or out["stocks"]):
        print("Refresh failed; existing snapshot preserved.", file=sys.stderr)
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
