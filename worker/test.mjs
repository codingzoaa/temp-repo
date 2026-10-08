import test from 'node:test';import assert from 'node:assert/strict';
import worker,{marketWindow,normalize} from './src/index.js';
test('Eastern daylight and standard market hours, weekends and close cutoff',()=>{
 assert(marketWindow(new Date('2026-10-08T13:30:00Z')));assert(marketWindow(new Date('2026-12-08T14:30:00Z')));
 assert(!marketWindow(new Date('2026-10-10T15:00:00Z')));assert(!marketWindow(new Date('2026-10-08T20:30:00Z')));
});
test('reject missing, mismatched and invalid quote data',()=>{
 const q={symbol:'SPY',close:'100',timestamp:1791470000,percent_change:'1'};
 assert.equal(normalize(q,'SPY').price,100);
 for(const bad of [{...q,close:null},{...q,timestamp:null},{...q,symbol:'QQQ'},{...q,percent_change:''},{status:'error'}])assert.throws(()=>normalize(bad,'SPY'));
});
test('public requests never collect data and unsupported methods fail',async()=>{
 let reads=0;const env={ALLOWED_ORIGIN:'https://codingzoaa.github.io',TWELVE_DATA_API_KEY:'test-secret',MARKET_CACHE:{get:async()=>{reads++;return {fetchedAt:'2020-01-01',quotes:[]};}}};
 const response=await worker.fetch(new Request('https://worker/api/market',{headers:{Origin:env.ALLOWED_ORIGIN}}),env);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);assert((await response.json()).stale);assert.equal(reads,1);
 assert.equal((await worker.fetch(new Request('https://worker/api/market',{method:'POST'}),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://worker/api/market'),{})).status,503);
});
