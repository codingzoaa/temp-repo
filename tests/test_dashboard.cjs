const fs=require('fs'),vm=require('vm'),assert=require('assert');
const target={innerHTML:''};
const context={document:{querySelector:s=>s==='.brief-card-track'?null:target,querySelectorAll:()=>[]},fetch:()=>new Promise(()=>{}),URL,Date,console,
 data:{indices:[],assets:[],rates:{}},finite:n=>typeof n==='number'&&Number.isFinite(n),signed:n=>(n>=0?'+':'')+n.toFixed(2),cls:n=>n>=0?'up':'down',esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
vm.createContext(context);vm.runInContext(fs.readFileSync('dashboard.js','utf8'),context);
assert(!vm.runInContext('editorialBrief()',context).includes('undefined'));
vm.runInContext(`data.indices=[{symbol:'^GSPC',change:1,date:'2026-10-07'},{symbol:'^IXIC',change:-1,date:'2026-10-07'}];data.rates={tenYear:{kind:"yield",price:4.5,changePoints:.02,date:'2026-10-07'}};newsBrief={topics:[],priorities:[{title:'<script>test</script>',topic:'AI',publisher:'source',url:'javascript:alert(1)',publishedAt:'2026-10-07T00:00:00Z',context:{why:'context',confirm:'check'}}]};`,context);
const html=vm.runInContext('editorialBrief()',context);
assert(html.includes('혼조 마감'));assert(html.includes('+0.02%p'));assert(html.includes('4.50%'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('href="javascript:'));assert(!html.includes('5.365'));assert(html.includes('아직 자동 연동하지'));
assert.equal((html.match(/<li><div><h4>/g)||[]).length,4);
assert.equal((html.match(/class="editorial-section /g)||[]).length,6);
assert(html.indexOf('오늘의 시장 한눈에 보기')<html.indexOf('주요 지수 마감'));
assert(html.includes('AI·반도체 집중 분석'));
assert(!html.includes('5.35'));
console.log('PASS: briefing facts, mixed close, yield units, missing data, safe sources, schedule transparency');
