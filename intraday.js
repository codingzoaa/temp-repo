// Intraday observations are kept separate from completed daily bars and analytics.
const INTRADAY_API='https://market-brief-api.kby0991.workers.dev/api/market';
async function loadIntraday(){
 const panel=document.querySelector('#intraday');
 if(document.hidden)return;
 try{
  const response=await fetch(INTRADAY_API,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Unavailable');
  const snapshot=await response.json();if(snapshot.schemaVersion!==1||!Array.isArray(snapshot.quotes))throw Error('Invalid');
  const quotes=snapshot.quotes.filter(q=>finite(q.price)&&finite(q.change)&&Number.isFinite(Date.parse(q.observedAt)));
  panel.innerHTML=`<div class="panel-heading"><div><h2>장중 ETF 시세</h2><p>Twelve Data · 15분 수집 · 제공처 플랜에 따라 지연 가능 · 실제 지수와 다른 ETF 가격</p></div><span class="subtle">${snapshot.stale?'최근 저장값 · 장 마감 또는 수집 지연':'서버 수집 '+esc(sourceTime(snapshot.fetchedAt))+' KST'}</span></div><div class="intraday-grid">${quotes.map(q=>`<div><b>${esc(q.symbol)} · ${esc(q.name)}</b><strong>${money(q.price)}</strong><span class="${cls(q.change)}">${signed(q.change)}%</span><small>관측 ${esc(sourceTime(q.observedAt))} KST${q.cached?' · 이전 수집값':''}</small></div>`).join('')||'<p>사용 가능한 시세가 없습니다.</p>'}</div>${snapshot.warnings?.length?'<p class="panel-note">일부 시세 요청 실패 또는 플랜 미지원 · 저장값의 관측 시각을 확인하세요.</p>':''}`;
 }catch{panel.innerHTML='<div class="panel-heading"><div><h2>장중 ETF 시세</h2><p>서버 연결 또는 초기 수집 대기 중입니다. 아래 일별 데이터는 계속 사용할 수 있습니다.</p></div></div>';}
}
loadIntraday();setInterval(loadIntraday,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadIntraday();});
