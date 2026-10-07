// Render collected observations only; never fall back to invented prices.
let data={indices:[],assets:[],stocks:[],leaders:[],highs:[]};
let period='1M';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const signed=n=>finite(n)?`${n>=0?'+':''}${n.toFixed(2)}`:'—';
const cls=n=>finite(n)?n>=0?'up':'down':'';
const money=n=>finite(n)?'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const scale=n=>!finite(n)?'—':n>=1e12?`$${(n/1e12).toFixed(2)}T`:n>=1e9?`$${(n/1e9).toFixed(2)}B`:money(n);
function chart(history=[],mini=false){
 const points=history.slice(-({'1W':5,'1M':22,'3M':64}[period])).filter(p=>finite(p.close));
 if(points.length<2)return '<span class="subtle">추이 데이터 없음</span>';
 const values=points.map(p=>p.close),low=Math.min(...values),high=Math.max(...values),range=high-low;
 const pts=values.map((v,i)=>[i/(values.length-1)*200,range?70-(v-low)/range*60:40]);
 const color=values.at(-1)>=values[0]?'#49d7ae':'#f47c8a';
 return `<svg class="${mini?'mini-chart':'chart'}" viewBox="0 0 200 80" preserveAspectRatio="none" role="img" aria-label="${esc(points[0].date)}부터 ${esc(points.at(-1).date)}까지 종가 추이"><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function stockLabel(s){return `<div class="stock"><span class="stock-icon">${esc(s.symbol.slice(0,2))}</span><div><strong>${esc(s.symbol)}</strong><small>${esc(s.name)}${s.date?' · '+esc(s.date):''}</small></div></div>`;}
function cards(items){return items.map(s=>`<article class="card"><div class="card-label">${esc(s.name)}<small>${esc(s.symbol)}</small></div><div class="value">${s.kind==='usd'?money(s.price):finite(s.price)?s.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+(s.kind==='yield'?'%':''):'—'}</div><div class="change ${cls(s.change)}">${signed(s.kind==='yield'?s.changePoints:s.change)}${s.kind==='yield'?'%p':'%'} <span class="subtle">일간</span></div>${chart(s.history)}<p class="subtle">${esc(s.date)} · ${esc(s.source)}</p></article>`).join('');}
function renderVolume(){
 const q=document.querySelector('#search').value.trim().toLowerCase();const rows=data.stocks.filter(s=>`${s.symbol} ${s.name}`.toLowerCase().includes(q));
 document.querySelector('#volume-body').innerHTML=rows.map(s=>`<tr><td class="rank">${esc(s.rank)}</td><td>${stockLabel(s)}</td><td>${money(s.price)}<small class="subtle"> ${esc(s.date||'미수집')}</small></td><td class="${cls(s.change)}">${signed(s.change)}${finite(s.change)?'%':''}</td><td>${scale(s.turnover)}</td><td>${chart(s.history,true)}</td></tr>`).join('');
 document.querySelector('#empty').hidden=rows.length>0;document.querySelector('#empty').textContent=data.stocks.length?'검색 결과가 없습니다.':'거래대금 데이터가 아직 수집되지 않았습니다.';
}
function render(){
 document.querySelector('#indices').innerHTML=cards(data.indices)||'<p>지수 데이터 미수집</p>';
 document.querySelector('#assets').innerHTML=cards(data.assets)||'<p>주요 자산 데이터 미수집</p>';renderVolume();
 document.querySelector('#leader-list').innerHTML=data.leaders.map(s=>`<div class="leader">${stockLabel(s)}<div class="leader-bar"><span style="width:${Math.min(100,Math.max(0,s.monthReturn))}%"></span></div><strong style="color:${s.monthReturn>=0?'var(--green)':'var(--red)'}">${signed(s.monthReturn)}%</strong></div>`).join('')||'<div class="panel-note">주도주 데이터 미수집</div>';
 document.querySelector('#high-body').innerHTML=data.highs.map(s=>`<tr><td>${stockLabel(s)}</td><td>${money(s.price)}</td><td>${scale(s.marketCap)}</td><td class="${cls(s.change)}">${signed(s.change)}%</td></tr>`).join('')||'<tr><td colspan="4">'+(data.universe?.complete?'해당 종목 없음':'전체 종목 검증 미완료 · 수집된 신고가 없음')+'</td></tr>';
}
function validate(snapshot){
 if(snapshot.schemaVersion!==1||!['indices','assets','stocks','leaders','highs','warnings'].every(k=>Array.isArray(snapshot[k]))||!Number.isFinite(Date.parse(snapshot.generatedAt))||!snapshot.universe)throw new Error('시세 파일 형식 오류');
 for(const key of ['indices','assets','stocks','leaders','highs'])for(const s of snapshot[key])if(typeof s.symbol!=='string'||typeof s.name!=='string'||(s.history&&!Array.isArray(s.history)))throw new Error('종목 데이터 형식 오류');
 return snapshot;
}
document.querySelectorAll('[data-period]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.period===period));button.addEventListener('click',()=>{period=button.dataset.period;document.querySelectorAll('[data-period]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});render();});});
document.querySelector('#search').addEventListener('input',renderVolume);
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>document.querySelectorAll('nav a').forEach(link=>link.classList.toggle('active',link===a))));
async function load(){
 try{
  const response=await fetch('data/market.json',{cache:'no-store'});if(!response.ok)throw new Error('수집된 시세 파일이 없습니다.');
  data=validate(await response.json());const stale=Date.now()-Date.parse(data.generatedAt)>36*3600000;
  document.querySelector('.mode').textContent=stale?'STALE DATA':data.warnings.length?'PARTIAL DATA':'DAILY DATA';
  document.querySelector('.date').innerHTML=`<span>최근 수집 · 한국 시간</span><strong>${esc(new Date(data.generatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}</strong><span>각 자산 관측일은 카드 참조 · 실시간 아님</span>`;
  document.querySelector('.sidebar-bottom').innerHTML='<span class="status-dot"></span> 무료 일별 데이터<p>Yahoo Finance / Nasdaq</p>';
  const u=data.universe;document.querySelector('.notice').textContent=`${stale?'⚠ 갱신 후 36시간이 지난 데이터입니다. ':''}${data.warnings.length?'⚠ 일부 수집 실패. ':''}Yahoo Finance 일봉 / Nasdaq 스크리너. 오늘 진행 중인 일봉 제외. 거래대금은 스크리너 가격 × 거래량 추정치이며 일봉 종가와 관측 시점이 다릅니다. 스크리너 관측: ${data.stocks[0]?.screenerAsOf||'시각 미제공'}. 시총 $10B 이상 ${u.fetched}/${u.eligible}종목 분석. ${u.complete?'':'신고가 목록은 전체 검증 미완료. '}`;
  document.querySelector('#data-status').textContent=data.warnings.length?'수집 경고: '+data.warnings.join(' / '):'전체 수집 완료 · 시세는 지연될 수 있습니다.';
 }catch(error){
  document.querySelector('.mode').textContent='NO DATA';document.querySelector('.notice').textContent='실제 데이터 연결 대기: '+error.message+' 네트워크 설정 적용 후 수집기를 실행해야 합니다. 예시 수치는 표시하지 않습니다.';
  document.querySelector('.date').innerHTML='<span>실제 데이터 연결 대기</span><strong>아직 갱신되지 않았습니다</strong>';document.querySelector('#data-status').textContent='시세 수집 미완료 · '+error.message;
 }
 render();
}
load();
