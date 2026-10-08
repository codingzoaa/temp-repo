const SYMBOLS = ['SPY', 'QQQ', 'DIA', 'SOXX'];
const LABELS = {SPY:'S&P 500 추종 ETF',QQQ:'나스닥 100 추종 ETF',DIA:'다우 추종 ETF',SOXX:'반도체 ETF'};
export function marketWindow(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  const minutes=Number(p.hour)*60+Number(p.minute);
  return !['Sat','Sun'].includes(p.weekday)&&minutes>=570&&minutes<=975;
}
export function normalize(raw, symbol) {
  const number = value => value!==null && value!=='' && value!==undefined && Number.isFinite(Number(value)) ? Number(value) : null;
  const price=number(raw.close),timestamp=number(raw.timestamp),change=number(raw.percent_change);
  if(raw.status==='error'||raw.symbol!==symbol||price===null||price<=0||timestamp===null||timestamp<=0||change===null)throw new Error('Unavailable quote');
  return {symbol,name:LABELS[symbol],price,change,observedAt:new Date(timestamp*1000).toISOString(),source:'Twelve Data',timing:'제공처 시세 · 실시간/지연 여부는 플랜에 따름'};
}
async function refresh(env) {
  if(!env.MARKET_CACHE||!env.TWELVE_DATA_API_KEY)return;
  const previous=await env.MARKET_CACHE.get('market',{type:'json'});
  const quotes=[],warnings=[];
  for(const symbol of SYMBOLS){
    try {
      const url=new URL('https://api.twelvedata.com/quote');url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',env.TWELVE_DATA_API_KEY);
      const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Provider response unavailable');
      quotes.push(normalize(await response.json(),symbol));
    }catch{
      warnings.push(`${symbol}: 시세 요청 실패 또는 플랜 미지원`);
      const saved=previous?.quotes?.find(q=>q.symbol===symbol);if(saved)quotes.push({...saved,cached:true});
    }
  }
  // Never return provider errors or credentials to the public client.
  await env.MARKET_CACHE.put('market',JSON.stringify({schemaVersion:1,fetchedAt:new Date().toISOString(),quotes,warnings,intervalMinutes:15}));
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','Vary':'Origin'};
    if(origin===env.ALLOWED_ORIGIN)headers['Access-Control-Allow-Origin']=origin;
    const reply=(body,status=200)=>Response.json(body,{status,headers});
    if(url.pathname==='/api/health')return reply({configured:!!(env.MARKET_CACHE&&env.TWELVE_DATA_API_KEY)});
    if(url.pathname!=='/api/market')return reply({error:'Not found'},404);
    if(request.method!=='GET')return reply({error:'Method not allowed'},405);
    if(!env.MARKET_CACHE||!env.TWELVE_DATA_API_KEY)return reply({error:'Server setup incomplete'},503);
    const snapshot=await env.MARKET_CACHE.get('market',{type:'json'});
    if(!snapshot)return reply({error:'Waiting for first scheduled collection'},503);
    return reply({...snapshot,stale:Date.now()-Date.parse(snapshot.fetchedAt)>30*60000});
  },
  async scheduled(event,env,ctx){if(marketWindow(new Date(event.scheduledTime)))ctx.waitUntil(refresh(env));}
};
