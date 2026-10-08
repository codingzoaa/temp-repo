"""S&P 500 membership from a public constituent dataset; observed prices from Yahoo/Nasdaq."""
import base64
import concurrent.futures
import csv
import datetime as dt
import io
import json
import os
from refresh_data import ROOT, fetch, screener, get_chart

ROSTER_URL='https://api.github.com/repos/datasets/s-and-p-500-companies/contents/data/constituents.csv'

def symbol_key(symbol):
    return symbol.replace('.','-').replace('/','-')

def parse_members(text):
    rows=list(csv.DictReader(io.StringIO(text)))
    if not 490<=len(rows)<=520 or any(not r.get('Symbol') or not r.get('GICS Sector') for r in rows):
        raise ValueError('Invalid S&P 500 constituent list')
    if len({symbol_key(r['Symbol']) for r in rows})!=len(rows):
        raise ValueError('Duplicate constituent symbols')
    return rows

def main():
    path=ROOT/'data'/'market.json'
    snapshot=json.loads(path.read_text())
    payload=fetch(ROSTER_URL)
    members=parse_members(base64.b64decode(payload['content']).decode('utf-8'))
    universe={symbol_key(s['symbol']):s for s in screener()}
    records=[];warnings=[]
    def collect(member):
        entry=universe.get(symbol_key(member['Symbol']))
        if not entry or not entry.get('marketCap') or entry['marketCap']<=0:
            raise ValueError('Market capitalization unavailable')
        q=get_chart(entry['symbol'],member['Security'])
        return {'symbol':member['Symbol'],'name':member['Security'],'sector':member['GICS Sector'],
                'industry':member.get('GICS Sub-Industry',''),'marketCap':entry['marketCap'],
                'price':q['price'],'change':q['change'],'date':q['date']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(collect,m):m for m in members}
        for future in concurrent.futures.as_completed(futures):
            member=futures[future]
            try:records.append(future.result())
            except Exception: warnings.append(member['Symbol']+': price or market cap unavailable')
    if not records:raise ValueError('No observed S&P 500 prices')
    snapshot['heatmap']=sorted(records,key=lambda s:s['marketCap'],reverse=True)
    snapshot['heatmapUniverse']={'scope':'S&P 500','members':len(members),'fetched':len(records),
         'source':'datasets/s-and-p-500-companies · public constituent dataset',
         'sourceUrl':'https://github.com/datasets/s-and-p-500-companies','rosterSha':payload['sha'],
         'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'warnings':warnings}
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(snapshot,ensure_ascii=False,allow_nan=False));os.replace(tmp,path)
    print(f'S&P 500 heatmap: {len(records)}/{len(members)} share classes, {len(warnings)} unavailable')

if __name__=='__main__':main()
