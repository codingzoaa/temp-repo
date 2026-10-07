// Isolated fixtures for UI checks only; never written into the served data directory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const history=Array.from({length:64},(_,i)=>({date:`test-${i}`,close:100+i}));
const stock={symbol:'TEST',name:'<img src=x onerror=alert(1)>',price:163,change:1.2,kind:'usd',history,rank:1,turnover:10000000000,marketCap:20000000000,monthReturn:10,date:'2026-10-06',source:'Fixture'};
const rate={...stock,symbol:'Y10',name:'미국 10년물 금리',kind:'yield',price:4.2,change:0.05,changePoints:0.05};
const snapshot={schemaVersion:2,generatedAt:new Date().toISOString(),indices:[stock],assets:[stock],
 rates:{twoYear:{...rate,symbol:'Y2',name:'미국 2년물 금리'},tenYear:rate,spread:{...rate,symbol:'SPREAD',name:'10Y-2Y 금리차',price:0.4}},
 sectors:[{symbol:'XLK',name:'Technology',change:1,weekReturn:2,monthReturn:3}],
 breadth:{scope:'test',count:3,advancers:2,decliners:1,unchanged:0,above20:70,above50:60,above200:80,newHighs:2,newLows:0},
 regime:{label:'RISK ON',tone:'positive',score:4,maxScore:5,summary:'test regime',signals:[{name:'SOX',positive:true,value:1}]},
 stocks:[stock],leaders:[stock],highs:[stock],warnings:[],universe:{fetched:1,eligible:1,complete:true}};
async function run(response){
 const elements=new Map();function el(k){if(!elements.has(k))elements.set(k,{innerHTML:'',textContent:'',value:'',hidden:false,events:{},addEventListener(k,f){this.events[k]=f;}});return elements.get(k);}
 const buttons=['1W','1M','3M'].map(p=>({dataset:{period:p},events:{},classList:{toggle(){}},setAttribute(){},addEventListener(k,f){this.events[k]=f;}}));
 const context={document:{querySelector:el,querySelectorAll:s=>s==='[data-period]'?buttons:[]},fetch:async()=>response,Date,console};
 vm.runInNewContext(fs.readFileSync('app.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));return {el,buttons};
}
(async()=>{
 let {el,buttons}=await run({ok:true,json:async()=>snapshot});
 assert.match(el('#volume-body').innerHTML,/TEST/);assert.match(el('#volume-body').innerHTML,/&lt;img/);assert.ok(!el('#volume-body').innerHTML.includes('<img'));
 assert.equal(el('.mode').textContent,'DAILY DATA');assert.match(el('#high-body').innerHTML,/20.00B/);assert.match(el('#regime-card').innerHTML,/RISK ON/);assert.match(el('#sector-grid').innerHTML,/Technology/);assert.match(el('#breadth-grid').innerHTML,/70.0%/);
 const before=el('#indices').innerHTML;buttons[2].events.click();assert.notEqual(el('#indices').innerHTML,before);
 el('#search').value='missing';el('#search').events.input();assert.equal(el('#empty').hidden,false);assert.equal(el('#volume-body').innerHTML,'');
 el('#search').value='test';el('#search').events.input();assert.equal(el('#empty').hidden,true);
 ({el}=await run({ok:false}));assert.equal(el('.mode').textContent,'NO DATA');assert.ok(!el('#volume-body').innerHTML.includes('TEST'));assert.match(el('.notice').textContent,/연결 대기/);
 ({el}=await run({ok:true,json:async()=>({...snapshot,generatedAt:'invalid'})}));assert.equal(el('.mode').textContent,'NO DATA');
 ({el}=await run({ok:true,json:async()=>({...snapshot,generatedAt:'2020-01-01T00:00:00Z'})}));assert.equal(el('.mode').textContent,'STALE DATA');
 console.log('PASS: collected data, escaped source text, search, period selection, missing/invalid data, stale indicator');
})().catch(e=>{console.error(e);process.exit(1);});
