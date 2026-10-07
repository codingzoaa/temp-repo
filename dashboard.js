let briefing={sectors:[],fearGreed:null};let sectorPeriod='1D';
const stateLabels={new:'🔥 신규 강세',strong:'↑ 강세 지속',steady:'→ 유지',weak:'↓ 약화'};
let newsBrief={topics:[],koreaIndices:[]};
function sourceTime(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'시각 미제공';}
function safeNewsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='news.google.com'?u.href:null;}catch{return null;}}
function topicMarket(key){
 let items=[];
 if(key==='korea')items=newsBrief.koreaIndices||[];
 if(key==='us')items=data.indices.filter(s=>['^GSPC','^IXIC'].includes(s.symbol));
 if(items.length)return `<div class="brief-market">${items.map(s=>`<span><b>${esc(s.name)}</b> <strong class="${cls(s.change)}">${signed(s.change)}%</strong><small>${esc(s.date)} 종가</small></span>`).join('')}</div>`;
 const symbol=key==='ai'?'SOXX':key==='datacenter'?'XLU':null;
 const sector=briefing.sectors?.find(s=>s.symbol===symbol);
 return sector?`<div class="brief-market"><span><b>${key==='ai'?'반도체 ETF':'유틸리티 ETF'} ${symbol}</b> <strong class="${cls(sector.periods['1D'].return)}">${signed(sector.periods['1D'].return)}%</strong><small>${esc(sector.date)} · SPY 대비 ${signed(sector.periods['1D'].relative)}%p</small></span></div>`:'';
}
function newsItems(items){return items.map(article=>{const url=safeNewsUrl(article.url);return `<li>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(article.title)} <span aria-hidden="true">↗</span></a>`:`<span>${esc(article.title)}</span>`}<div class="brief-source">${esc(article.publisher)} · ${esc(sourceTime(article.publishedAt))} KST</div></li>`;}).join('');}
function priorityBrief(){
 const issues=newsBrief.priorities||[];if(!issues.length)return '';
 const themes=[...new Set(issues.slice(0,3).map(a=>a.context?.themeLabel||a.topic))];
 const opening='오늘의 확인 순서는 '+themes.join(' → ')+'입니다. 발표가 실제 수주·매출로 이어지는지, 금리·전력 비용이 사업성에 어떤 영향을 주는지 함께 봅니다.';
 return `<div class="brief-today"><span>오늘 먼저 볼 이슈</span><p>${esc(opening)}</p></div><div class="priority-heading"><h3>핵심 이슈 TOP ${issues.length}</h3><span>실적·수주·금리·정책 관련 보도 우선</span></div><div class="priority-list">${issues.map((article,i)=>{const c=article.context||{},url=safeNewsUrl(article.url);return `<details class="priority-issue" ${i===0?'open':''}><summary><span class="priority-rank">${i+1}</span><div><small>${esc(article.topic)} · ${esc(c.themeLabel||'시장 흐름')}${article.cached?' · 이전 수집값':''}</small><h4>${esc(article.title)}</h4></div><span class="expand-sign" aria-hidden="true">＋</span></summary><div class="priority-body"><div class="brief-source">${esc(article.publisher)} · ${esc(sourceTime(article.publishedAt))} KST ${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">기사 원문 ↗</a>`:''}</div><div class="issue-why"><b>왜 중요한가 · 산업 관점</b><p>${esc(c.why||'기사 원문과 가격 반응을 함께 확인하세요.')}</p></div>${c.companies?.length?`<div class="issue-watch"><b>연결해서 볼 기업·업종</b><div>${c.companies.map(name=>`<span>${esc(name)}</span>`).join('')}</div></div>`:''}<div class="issue-risk"><b>반대편 리스크</b><p>${esc(c.risk||'실제 계약·실적 변화의 확인이 필요합니다.')}</p></div><div class="issue-confirm"><b>오늘의 체크</b><p>${esc(c.confirm||'발표와 확정된 자료를 구분해 확인하세요.')}</p></div></div></details>`;}).join('')}</div>`;
}
function valueChainBrief(){
 const chain=newsBrief.valueChain||[];if(!chain.length)return '';
 return `<div class="value-chain-brief"><h3>AI 밸류체인 연결해서 보기</h3><p>최근 수집 기사에 등장한 분야 · 수혜 강도나 매수 순위가 아닙니다</p><div class="chain-stages">${chain.map(stage=>`<span class="${stage.count?'mentioned':''}"><b>${esc(stage.label)}</b><small>${stage.count?stage.count+'개 기사':'관련 기사 없음'}</small></span>`).join('')}</div><div class="chain-check">투자 발표 → 확정 수주 → 전력·인허가 → 가동 → 매출·현금흐름의 순서로 확인하세요.</div></div>`;
}
function renderSummary(){
 const defaults=[['korea','한국 주식'],['us','미국 주식'],['ai','AI · 반도체'],['datacenter','데이터센터 · 전력']];
 document.querySelector('#market-summary').innerHTML=`<div class="briefing-heading"><div><div class="eyebrow">MORNING INVESTMENT BRIEF</div><h2>오늘의 시장 브리핑</h2><p>한국·미국 주식·AI·데이터센터</p></div><span class="brief-update">${newsBrief.generatedAt?'수집 '+esc(sourceTime(newsBrief.generatedAt))+' KST':'뉴스 연결 확인 중'}</span></div>${priorityBrief()}<div class="topic-group-heading">분야별 시장 흐름</div><div class="news-topic-grid">${defaults.map(([key,label],index)=>{const topic=newsBrief.topics.find(t=>t.key===key)||{articles:[]};const articles=topic.articles||[];return `<article class="news-topic"><div class="news-topic-heading"><span class="topic-number">${String(index+1).padStart(2,'0')}</span><h3>${label}</h3>${topic.cached?'<span class="cached-label">이전 수집값</span>':''}</div>${topicMarket(key)}<div class="news-label">최근 주요 기사</div>${articles.length?`<ul class="brief-news-list">${newsItems(articles.slice(0,1))}</ul>${articles.length>1?`<details class="more-news"><summary>관련 기사 더 보기</summary><ul class="brief-news-list">${newsItems(articles.slice(1))}</ul></details>`:''}`:'<p class="news-unavailable">최근 기사를 아직 가져오지 못했습니다.</p>'}${topic.checkpoint?`<div class="brief-checkpoint"><b>체크포인트</b><p>${esc(topic.checkpoint)}</p></div>`:''}</article>`;}).join('')}</div>${valueChainBrief()}<details class="briefing-method"><summary>브리핑 기준·출처</summary><p>기사 제목과 원문 링크를 수집해 실적·수주·금리·정책 등의 이슈를 우선 정렬합니다. 보도 제목은 사실 출처이며, 산업 관점·관찰 기업·리스크는 해당 주제의 일반적인 연결 관계입니다. 기사 본문을 요약한 문장이나 개별 기업의 확정 수혜 판정은 아닙니다. 가격 정보는 완료 종가 기준이며 기사 발행 시각과 다를 수 있습니다. 체크포인트는 각 분야에서 확인할 일반적인 항목입니다. 데이터센터의 유틸리티 ETF는 전력 섹터의 참고 지표이며 데이터센터 전체 업종을 대표하지 않습니다. ${esc(newsBrief.method||'')}</p>${newsBrief.warnings?.length?`<p>수집 상태: ${esc(newsBrief.warnings.join(' / '))}</p>`:''}</details>`;
}
async function loadNews(){try{const response=await fetch('data/news.json',{cache:'no-store'});if(!response.ok)throw new Error('No news');const snapshot=await response.json();if(!Array.isArray(snapshot.topics))throw new Error('Invalid news');newsBrief=snapshot;}catch{newsBrief={topics:[],koreaIndices:[]};}renderSummary();}
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
renderDashboard();loadBriefing();loadNews();
