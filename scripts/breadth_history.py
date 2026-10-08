"""Historical breadth for today's observed stock universe, not historical constituents."""
import math

def build_history(candidates, days=63):
    dates=sorted({p['date'] for s in candidates for p in s.get('history',[])})[-days:]
    observations={date:{'date':date,'advancers':0,'decliners':0,'unchanged':0,'measured':0,
                  'newHighs':0,'newLows':0,'highEligible':0,
                  **{f'{key}{n}':0 for n in [20,50,200] for key in ['above','eligible']}} for date in dates}
    for stock in candidates:
        history=stock.get('history',[])
        for i,p in enumerate(history):
            row=observations.get(p['date'])
            if row is None:continue
            close=p.get('close');adj=p.get('adjusted',close)
            if not isinstance(adj,(int,float)) or not math.isfinite(adj):continue
            if i>=1 and close is not None and history[i-1].get('close') is not None:
                prev=history[i-1]['close'];row['measured']+=1
                row['advancers' if close>prev else 'decliners' if close<prev else 'unchanged']+=1
            for n in [20,50,200]:
                if i+1<n:continue
                values=[q.get('adjusted',q.get('close')) for q in history[i-n+1:i+1]]
                if any(v is None or not math.isfinite(v) for v in values):continue
                row[f'eligible{n}']+=1;row[f'above{n}']+=int(adj>sum(values)/n)
            if i>=252:
                previous=[q.get('adjusted',q.get('close')) for q in history[i-252:i]]
                if any(v is None or not math.isfinite(v) for v in previous):continue
                row['highEligible']+=1;row['newHighs']+=int(adj>=max(previous));row['newLows']+=int(adj<=min(previous))
    for row in observations.values():
        for n in [20,50,200]:row[f'above{n}']=100*row[f'above{n}']/row[f'eligible{n}'] if row[f'eligible{n}'] else None
        if not row['highEligible']:row['newHighs']=row['newLows']=None
        if not row['measured']:row['advancers']=row['decliners']=row['unchanged']=None
        row['advanceRatio']=100*row['advancers']/row['measured'] if row['measured'] else None
    return list(observations.values())
