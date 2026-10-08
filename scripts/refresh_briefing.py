"""Daily sector rotation and CNN sentiment; independent of the large stock scan."""
import datetime as dt
import json
import os
import sys
import urllib.request
from refresh_data import ROOT, get_chart, number

SECTORS = [('SOXX','Semiconductor','반도체'),('XLK','Technology','기술'),
 ('XLF','Financials','금융'),('XLE','Energy','에너지'),('XLV','Healthcare','헬스케어'),
 ('XLI','Industrials','산업재'),('XLY','Consumer Discretionary','경기소비재'),
 ('XLP','Consumer Staples','필수소비재'),('XLU','Utilities','유틸리티'),
 ('XLB','Materials','소재'),('XLRE','Real Estate','부동산'),('XLC','Communication','커뮤니케이션')]

def rotation(record, benchmark):
    own={p['date']:p for p in record['history']}
    base={p['date']:p for p in benchmark['history']}
    dates=sorted(own.keys() & base.keys())
    if len(dates)<22 or record['date']!=benchmark['date']:
        raise ValueError(f"{record['symbol']}: insufficient or mismatched benchmark dates")
    def price(mapping,date):return mapping[date].get('adjusted',mapping[date]['close'])
    def performance(n):
        stock=(price(own,dates[-1])/price(own,dates[-n-1])-1)*100
        market=(price(base,dates[-1])/price(base,dates[-n-1])-1)*100
        return {'return':stock,'relative':stock-market}
    daily=[]
    for previous,current in zip(dates,dates[1:]):
        daily.append((price(own,current)/price(own,previous)-price(base,current)/price(base,previous))*100)
    streak=0
    for value in reversed(daily):
        if value<=0:break
        streak+=1
    acceleration=sum(daily[-3:])/3-sum(daily[-6:-3])/3
    if daily[-1]>0 and (daily[-2]<=0 or acceleration>=.25):
        state,detail='new','신규 가속' if acceleration>=.25 else '신규 강세 전환'
    elif daily[-1]>0 and streak>=2:
        state,detail='strong',f'{streak}일 연속 상대 강세'
    elif daily[-1]<0 and daily[-1]<daily[-2]:
        state,detail='weak','상대강도 하락'
    else:
        state,detail='steady','흐름 유지'
    return {**record,'periods':{'1D':performance(1),'1W':performance(5),'1M':performance(21)},
            'state':state,'detail':detail,'streak':streak,'acceleration':acceleration}

def sentiment_history(raw):
    points={}
    for point in (raw.get('fear_and_greed_historical') or {}).get('data',[]):
        score=number(point.get('y'));stamp=number(point.get('x'))
        if score is None or stamp is None or not 0<=score<=100:continue
        try:date=dt.datetime.fromtimestamp(stamp/1000,dt.timezone.utc).date().isoformat()
        except (ValueError,OverflowError,OSError):continue
        points[date]={'date':date,'close':score}
    dates=sorted(points)
    if not dates:return []
    cutoff=(dt.date.fromisoformat(dates[-1])-dt.timedelta(days=365)).isoformat()
    return [points[d] for d in dates if d>=cutoff]

def sentiment():
    start=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=365)).date().isoformat()
    url='https://production.dataviz.cnn.io/index/fearandgreed/graphdata/'+start
    request=urllib.request.Request(url,headers={
        'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept':'application/json','Origin':'https://edition.cnn.com',
        'Referer':'https://edition.cnn.com/markets/fear-and-greed'})
    with urllib.request.urlopen(request,timeout=20) as response:raw=json.load(response)
    source=raw.get('fear_and_greed') or {}
    score=number(source.get('score'))
    if score is None or not 0<=score<=100 or not source.get('timestamp'):
        raise ValueError('CNN score or observation timestamp unavailable')
    return {'score':score,'rating':source.get('rating'),'timestamp':source['timestamp'],
            'previousClose':number(source.get('previous_close')),
            'previousWeek':number(source.get('previous_1_week')),
            'previousMonth':number(source.get('previous_1_month')),
            'history':sentiment_history(raw),'source':'CNN','url':'https://edition.cnn.com/markets/fear-and-greed'}

def main():
    path=ROOT/'data/briefing.json'
    previous=json.loads(path.read_text()) if path.exists() else {}
    out={'schemaVersion':1,'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
         'sectors':[],'fearGreed':None,'warnings':[],'benchmark':'SPY'}
    failed=False
    try:
        benchmark=get_chart('SPY','S&P 500 ETF')
        for ticker,name,korean in SECTORS:
            try:
                record=rotation(get_chart(ticker,name),benchmark)
                record['korean']=korean
                out['sectors'].append(record)
            except Exception as error:
                failed=True;out['warnings'].append(f'{ticker}: {error}')
        out['sectors'].sort(key=lambda s:s['periods']['1D']['relative'],reverse=True)
    except Exception as error:
        failed=True;out['warnings'].append(f'Sector data: {error}')
    try:out['fearGreed']=sentiment()
    except Exception as error:
        out['warnings'].append(f'CNN Fear & Greed: {error}')
        out['fearGreed']=previous.get('fearGreed')
        out['fearGreedCached']=bool(out['fearGreed'])
    if failed:
        print('\n'.join(out['warnings']),file=sys.stderr)
        return 1  # Preserve a complete sector snapshot on request failure.
    temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(out,ensure_ascii=False,allow_nan=False),encoding='utf-8')
    os.replace(temporary,path)
    print(f"Saved {len(out['sectors'])} sectors; CNN {'available' if out['fearGreed'] else 'unavailable'}")
    for warning in out['warnings']:print(warning)
    return 0

if __name__=='__main__':sys.exit(main())
