let briefing={sectors:[],fearGreed:null};let sectorPeriod='1D';
const stateLabels={new:'🔥 신규 강세',strong:'↑ 강세 지속',steady:'→ 유지',weak:'↓ 약화'};
function renderSummary(){
 const indices=data.indices.filter(s=>finite(s.change));
 const sorted=[...indices].sort((a,b)=>b.change-a.change);
 const positive=indices.filter(s=>s.change>0).length;
 const leaders=[...(briefing.sectors||[])].sort((a,b)=>b.periods['1W'].relative-a.periods['1W'].relative);
 document.querySelector('#market-summary').innerHTML=`<div class="summary-title"><div class="eyebrow">DAILY PULSE</div><h2>오늘의 시장 요약</h2><span>완료 종가에 기반한 데이터 브리핑</span></div>${indices.length?`<h3>${positive===indices.length?'주요 지수 모두 상승':positive===0?'주요 지수 전반 하락':`주요 지수 ${indices.length}개 중 ${positive}개 상승`}</h3><div class="summary-lines"><p><b>지수 흐름</b><span>${esc(sorted[0].name)} ${signed(sorted[0].change)}% · ${esc(sorted.at(-1).name)} ${signed(sorted.at(-1).change)}%</span></p>${leaders.length?`<p><b>섹터 주도</b><span>${esc(leaders[0].korean)}(${esc(leaders[0].symbol)}) · 1주 SPY 대비 ${signed(leaders[0].periods['1W'].relative)}%p</span></p>`:''}<p><b>관측일</b><span>${esc(indices[0].date)} 미국장 · 자산별 날짜는 카드 참조</span></p></div>`:'<p>시장 데이터 연결 대기 중입니다.</p>'}`;
}
function renderFear(){
 const fg=briefing.fearGreed;const el=document.querySelector('#fear-greed');
 const title='<div class="sentiment-head"><div><div class="eyebrow">MARKET SENTIMENT</div><h2>Fear & Greed Index</h2></div><a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer">CNN 원문 ↗</a></div>';
 if(!fg||!finite(fg.score)){el.innerHTML=title+'<div class="sentiment-missing"><strong>현재 CNN 지수를 가져올 수 없습니다</strong><p>CNN 데이터 응답이 복구되면 자동 갱신합니다.<br>원문 링크에서 최신 수치를 확인할 수 있습니다.</p></div>';return;}
 const labels={'extreme fear':'극단적 공포',fear:'공포',neutral:'중립',greed:'탐욕','extreme greed':'극단적 탐욕'};
 const label=labels[String(fg.rating).toLowerCase()]||(fg.score<=25?'극단적 공포':fg.score<=45?'공포':fg.score<=55?'중립':fg.score<=75?'탐욕':'극단적 탐욕');
 const timestamp=typeof fg.timestamp==='number'?(fg.timestamp<1e11?fg.timestamp*1000:fg.timestamp):fg.timestamp;
 const observation=new Date(timestamp);const stale=briefing.fearGreedCached||Date.now()-observation.getTime()>36*3600000;
 el.innerHTML=title+`<div class="sentiment-score"><strong>${Math.round(fg.score)}</strong><div><b>${esc(label)}</b><span>100점 기준 · ${stale?'최근 저장값':'CNN 관측값'}</span></div></div><div class="sentiment-gauge"><span style="left:${fg.score}%"></span></div><div class="gauge-labels"><span>극단적 공포</span><span>중립</span><span>극단적 탐욕</span></div><div class="sentiment-history">${[['전일',fg.previousClose],['1주 전',fg.previousWeek],['1개월 전',fg.previousMonth]].map(([l,n])=>`<span>${l} <b>${finite(n)?Math.round(n):'—'}</b></span>`).join('')}</div><p class="sentiment-date">관측 ${Number.isFinite(observation.getTime())?esc(observation.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})):'시각 미제공'} KST${stale?' · 최신 값 확인 필요':''}</p>`;
}
function renderSectors(){
 const sectors=[...(briefing.sectors||[])].sort((a,b)=>b.periods[sectorPeriod].relative-a.periods[sectorPeriod].relative);
 if(!sectors.length){document.querySelector('#sector-table').innerHTML='<p class="panel-note">섹터 데이터 수집 대기 중입니다.</p>';return;}
 document.querySelector('#sector-table').innerHTML=`<div class="rotation-note">정렬: ${sectorPeriod} SPY 대비 초과 수익률 · 관측 ${esc(sectors[0].date)} <span>큰 숫자: ETF 수익률 / 아래: SPY 대비 %p</span></div><div class="table-scroll"><table class="rotation-table"><thead><tr><th>섹터 / ETF</th><th>최신 상태</th>${['1D','1W','1M'].map(p=>`<th class="${p===sectorPeriod?'sort-column':''}">${p}</th>`).join('')}</tr></thead><tbody>${sectors.map(s=>`<tr><td><div class="sector-name"><strong>${esc(s.korean)}</strong><span>${esc(s.name)} · ${esc(s.symbol)}</span></div></td><td><div class="state-badge ${esc(s.state)}">${stateLabels[s.state]||'→ 유지'}</div><small class="state-detail">${esc(s.detail)}</small></td>${['1D','1W','1M'].map(p=>{const n=s.periods[p];return `<td class="${p===sectorPeriod?'sort-column':''}"><strong class="${cls(n.return)}">${signed(n.return)}%</strong><small class="relative ${cls(n.relative)}">${signed(n.relative)}%p</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderDashboard(){renderSummary();renderFear();renderSectors();}
document.querySelectorAll('[data-sector-period]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.sectorPeriod===sectorPeriod));button.addEventListener('click',()=>{sectorPeriod=button.dataset.sectorPeriod;document.querySelectorAll('[data-sector-period]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});renderSectors();});});
async function loadBriefing(){
 try{const response=await fetch('data/briefing.json',{cache:'no-store'});if(!response.ok)throw new Error('No briefing data');const snapshot=await response.json();if(!Array.isArray(snapshot.sectors))throw new Error('Invalid briefing');briefing=snapshot;}catch(error){briefing={sectors:[],fearGreed:null};}
 renderDashboard();
}
renderDashboard();loadBriefing();
