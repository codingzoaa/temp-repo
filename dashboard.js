let briefing={sectors:[],fearGreed:null};let sectorPeriod='1D';
const stateLabels={new:'🔥 신규 강세',strong:'↑ 강세 지속',steady:'→ 유지',weak:'↓ 약화'};
let newsBrief={topics:[],koreaIndices:[]};let briefCardIndex=0;
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
function briefSource(article){const url=safeNewsUrl(article.url);return `<div class="brief-source">${esc(article.publisher)} · ${esc(sourceTime(article.publishedAt))} KST${article.cached?' · 이전 수집값':''} ${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">출처 ↗</a>`:''}</div>`;}
function editorialBrief(){
 const indices=data.indices||[],sectors=(briefing.sectors||[]).filter(s=>finite(s.periods?.['1D']?.relative));
 const sp=indices.find(s=>s.symbol==='^GSPC'),nas=indices.find(s=>s.symbol==='^IXIC');
 const rate=data.rates?.tenYear,short=data.rates?.twoYear;
 const ordered=[...sectors].sort((a,b)=>b.periods['1D'].relative-a.periods['1D'].relative);
 const best=ordered[0],worst=ordered[ordered.length-1];
 const issues=newsBrief.priorities||[],lead=issues[0];
 const rows=[];
 if(sp&&nas)rows.push({title:`미국 증시 ${sp.change>0&&nas.change>0?'동반 상승':sp.change<0&&nas.change<0?'동반 하락':'혼조 마감'}`,body:`S&P 500 ${signed(sp.change)}%, 나스닥 ${signed(nas.change)}%.`,source:`${sp.date} / ${nas.date} 완료 종가 · Yahoo Finance`});
 if(rate&&finite(rate.price))rows.push({title:`미국 10년물 ${rate.price.toFixed(2)}%`,body:`전일 대비 ${signed(rate.changePoints)}%p. 장기금리는 성장주 평가와 데이터센터 자금조달 비용의 확인 지표입니다.`,source:`${rate.date} · 미국 재무부`});
 if(lead)rows.push({title:lead.title,body:'오늘의 주요 보도 · '+lead.topic,article:lead});
 const section=(label,title,body)=>`<section class="editorial-section"><span class="editorial-label">${label}</span><h3>${esc(title)}</h3>${body}</section>`;
 let result=section("TODAY'S SUMMARY",rows[0]?.title||'오늘의 핵심 브리핑',`<ol class="editorial-summary">${rows.slice(0,3).map(r=>`<li><div><h4>${esc(r.title)}</h4><p>${esc(r.body)}</p>${r.article?briefSource(r.article):`<small>${esc(r.source)}</small>`}</div></li>`).join('')}</ol>`);
 if(lead)result+=section("TODAY'S ISSUE",lead.title,`${briefSource(lead)}<div class="editorial-insight"><b>시장에 연결해서 보면</b><p>${esc(lead.context?.why||'실제 가격 반응과 실적 변화를 함께 확인하세요.')}</p></div><p class="editorial-check"><b>확인할 변수</b> ${esc(lead.context?.confirm||'기사 원문과 확정 발표를 확인하세요.')}</p>`);
 if(best&&worst)result+=section('SECTOR FOCUS',`${best.korean} 상대 우위, ${worst.korean} 상대 부진`,`<div class="editorial-number ${cls(best.periods['1D'].return)}">${signed(best.periods['1D'].return)}%</div><p>${esc(best.korean)} ${esc(best.symbol)} · ${esc(best.date)} 일간 수익률</p><div class="editorial-strips"><div><b>${esc(best.korean)}</b> SPY 대비 <strong class="${cls(best.periods['1D'].relative)}">${signed(best.periods['1D'].relative)}%p</strong> · ${stateLabels[best.state]||'→ 유지'}</div><div><b>${esc(worst.korean)}</b> ${signed(worst.periods['1D'].return)}% · SPY 대비 ${signed(worst.periods['1D'].relative)}%p</div></div><p>상대 우위는 SPY 대비 흐름입니다. 아래 Sector Rotation에서 1주·1개월 추세까지 확인하세요.</p>`);
 if(rate&&finite(rate.price))result+=section('RATES WATCH','미국 국채 금리와 주요 자산',`<div class="editorial-number rate-number">${rate.price.toFixed(2)}%</div><p>미국 10년물 · ${esc(rate.date)} 종가 · 미국 재무부</p><div class="editorial-strips"><div>10년물 전일 대비 <b>${signed(rate.changePoints)}%p</b>${short&&finite(short.price)?` · 2년물 <b>${short.price.toFixed(2)}%</b> (${esc(short.date)})`:''}</div>${(data.assets||[]).filter(a=>['^VIX','CL=F','GC=F'].includes(a.symbol)&&finite(a.price)).map(a=>`<div><b>${esc(a.name)}</b> ${a.price.toLocaleString('ko-KR',{maximumFractionDigits:2})} · <strong class="${cls(a.change)}">${signed(a.change)}%</strong><small>${esc(a.date)} · Yahoo Finance</small></div>`).join('')}</div><p>국채 금리의 변화는 %p, 자산 가격의 등락은 %입니다. 금리와 주가가 함께 움직였다는 사실만으로 인과관계를 단정하지 않습니다.</p>`);
 const topics=newsBrief.topics||[];
 result+=section('MARKET & AI BRIEF','한국·미국·AI·데이터센터',`<div class="editorial-topics">${topics.map(t=>`<div><h4>${esc(t.label||t.name||({korea:'한국 주식',us:'미국 주식',ai:'AI · 반도체',datacenter:'데이터센터 · 전력'}[t.key]))}${t.cached?' · 이전 수집값':''}</h4>${topicMarket(t.key)}${t.articles?.length?`<p>${esc(t.articles[0].title)}</p>${briefSource(t.articles[0])}`:'<p>최근 보도를 가져오지 못했습니다.</p>'}</div>`).join('')}</div>`);
 const companyPattern=/삼성|하이닉스|엔비디아|NVIDIA|AMD|마벨|Marvell|브로드컴|Broadcom|HD건설기계|현대엔지니어링|마이크론|Micron|메타|테슬라|애플|TSMC|버티브|Vertiv/i;
 const seen=new Set();const companyNews=topics.flatMap(t=>t.articles||[]).filter(a=>{if(!companyPattern.test(a.title)||seen.has(a.url))return false;seen.add(a.url);return true;}).slice(0,6);
 result+=section('COMPANY NEWS','개별 기업 뉴스',companyNews.length?`<ul class="editorial-companies">${companyNews.map(a=>`<li><p>${esc(a.title)}</p>${briefSource(a)}</li>`).join('')}</ul>`:'<p>이번 수집에서 확인된 개별 기업 보도가 없습니다.</p>');
 result+=section('DATA & SCHEDULE','다음 확인할 일정',`<p>경제지표·실적의 발표 시각과 예상치는 아직 자동 연동하지 않았습니다. 확정 일정은 아래 공식 자료에서 확인하세요.</p><div class="editorial-calendar"><a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" target="_blank" rel="noopener noreferrer">연준 FOMC 일정 ↗</a><a href="https://www.bls.gov/schedule/" target="_blank" rel="noopener noreferrer">미국 고용·물가 발표 ↗</a></div><div class="editorial-insight"><b>브리핑 자동 갱신</b><p>한국 시간 화~토 오전 7시 15분</p></div>`);
 return result;
}
function renderSummary(){
 document.querySelector('#market-summary').innerHTML=`<div class="briefing-heading"><div><div class="eyebrow">DAILY MARKET BRIEF</div><h2>오늘의 시장 브리핑</h2></div><span class="brief-update">${newsBrief.generatedAt?'수집 '+esc(sourceTime(newsBrief.generatedAt))+' KST':'뉴스 연결 확인 중'}</span></div><div class="brief-carousel"><div class="brief-carousel-controls"><button type="button" data-brief-step="-1" aria-label="이전 카드">←</button><div class="brief-card-tabs" role="group" aria-label="브리핑 카드 선택"></div><button type="button" data-brief-step="1" aria-label="다음 카드">→</button></div><div class="brief-card-track" aria-label="옆으로 넘기는 시장 브리핑">${editorialBrief()}</div></div><details class="briefing-method"><summary>출처·요약 기준</summary><p>가격은 표시된 관측일의 완료 종가입니다. 뉴스는 무료 RSS에서 확인한 보도 제목을 중심으로 정리하며, 기사 본문 전체의 요약은 제공하지 않습니다. 시장 해석과 확인할 변수는 주제에 따른 일반적인 분석이며 확정된 수혜 판단이 아닙니다. 예시 이미지의 과거 수치·인용문·일정은 사용하지 않습니다. 섹터는 SPY 대비 일간 상대 수익률로 비교합니다.</p>${newsBrief.warnings?.length?`<p>수집 상태: ${esc(newsBrief.warnings.join(' / '))}</p>`:''}</details>`;
 setupBriefCards();
}
function setupBriefCards(){
 const track=document.querySelector('.brief-card-track');if(!track)return;
 const cards=[...track.querySelectorAll('.editorial-section')],tabs=document.querySelector('.brief-card-tabs');
 const names={"TODAY'S SUMMARY":'요약',"TODAY'S ISSUE":'주요 이슈','SECTOR FOCUS':'섹터','RATES WATCH':'금리','MARKET & AI BRIEF':'시장·AI','COMPANY NEWS':'기업','DATA & SCHEDULE':'일정'};
 tabs.innerHTML=cards.map((card,i)=>`<button type="button" data-brief-card="${i}" aria-label="${esc(card.querySelector('.editorial-label').textContent)}">${names[card.querySelector('.editorial-label').textContent]||i+1}</button>`).join('');
 function update(){tabs.querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('selected',i===briefCardIndex);b.setAttribute('aria-pressed',String(i===briefCardIndex));});document.querySelector('[data-brief-step="-1"]').disabled=briefCardIndex===0;document.querySelector('[data-brief-step="1"]').disabled=briefCardIndex===cards.length-1;}
 function go(index,smooth=true){briefCardIndex=Math.max(0,Math.min(cards.length-1,index));track.scrollTo({left:cards[briefCardIndex].offsetLeft-cards[0].offsetLeft,behavior:smooth?'smooth':'instant'});update();}
 tabs.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.briefCard))));
 document.querySelectorAll('[data-brief-step]').forEach(b=>b.addEventListener('click',()=>go(briefCardIndex+Number(b.dataset.briefStep))));
 track.addEventListener('scroll',()=>{if(!track.isConnected)return;briefCardIndex=cards.reduce((best,c,i)=>Math.abs(c.offsetLeft-cards[0].offsetLeft-track.scrollLeft)<Math.abs(cards[best].offsetLeft-cards[0].offsetLeft-track.scrollLeft)?i:best,0);update();},{passive:true});
 track.tabIndex=0;track.addEventListener('keydown',e=>{if(e.target===track&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();go(briefCardIndex+(e.key==='ArrowRight'?1:-1));}});go(briefCardIndex,false);
}
async function loadNews(){try{const response=await fetch('data/news.json',{cache:'no-store'});if(!response.ok)throw new Error('No news');const snapshot=await response.json();if(!Array.isArray(snapshot.topics))throw new Error('Invalid news');newsBrief=snapshot;}catch{newsBrief={topics:[],koreaIndices:[]};}renderSummary();}
function renderFear(){
 const fg=briefing.fearGreed;const el=document.querySelector('#fear-greed');
 const title=`<div class="sentiment-head"><div><div class="eyebrow">MARKET SENTIMENT</div><h2><button type="button" class="fear-chart-toggle" data-fear-toggle aria-expanded="${typeof fearExpanded!=='undefined'&&fearExpanded}">Fear & Greed Index <span>⌄</span></button></h2></div><a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer">CNN 원문 ↗</a></div>`;
 if(!fg||!finite(fg.score)){el.innerHTML=title+'<div class="sentiment-missing"><strong>현재 CNN 지수를 가져올 수 없습니다</strong><p>CNN 데이터 응답이 복구되면 자동 갱신합니다.<br>원문 링크에서 최신 수치를 확인할 수 있습니다.</p></div>';return;}
 const labels={'extreme fear':'극단적 공포',fear:'공포',neutral:'중립',greed:'탐욕','extreme greed':'극단적 탐욕'};
 const label=labels[String(fg.rating).toLowerCase()]||(fg.score<=25?'극단적 공포':fg.score<=45?'공포':fg.score<=55?'중립':fg.score<=75?'탐욕':'극단적 탐욕');
 const timestamp=typeof fg.timestamp==='number'?(fg.timestamp<1e11?fg.timestamp*1000:fg.timestamp):fg.timestamp;
 const observation=new Date(timestamp);const stale=briefing.fearGreedCached||Date.now()-observation.getTime()>36*3600000;
 el.innerHTML=title+`<div class="sentiment-score"><strong>${Math.round(fg.score)}</strong><div><b>${esc(label)}</b><span>100점 기준 · ${stale?'최근 저장값':'CNN 관측값'}</span></div></div><div class="sentiment-gauge"><span style="left:${fg.score}%"></span></div><div class="gauge-labels"><span>극단적 공포</span><span>중립</span><span>극단적 탐욕</span></div><div class="sentiment-history">${[['전일',fg.previousClose],['1주 전',fg.previousWeek],['1개월 전',fg.previousMonth]].map(([l,n])=>`<span>${l} <b>${finite(n)?Math.round(n):'—'}</b></span>`).join('')}</div><p class="sentiment-date">관측 ${Number.isFinite(observation.getTime())?esc(observation.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})):'시각 미제공'} KST${stale?' · 최신 값 확인 필요':''}</p>${typeof fearHistoryMarkup==='function'?fearHistoryMarkup(fg):''}`;
}
function renderSectors(){
 const sectors=[...(briefing.sectors||[])].sort((a,b)=>b.periods[sectorPeriod].relative-a.periods[sectorPeriod].relative);
 if(!sectors.length){document.querySelector('#sector-table').innerHTML='<p class="panel-note">섹터 데이터 수집 대기 중입니다.</p>';return;}
 document.querySelector('#sector-table').innerHTML=`<div class="rotation-note">정렬: ${sectorPeriod} SPY 대비 초과 수익률 · 관측 ${esc(sectors[0].date)} <span>큰 숫자: ETF 수익률 / 아래: SPY 대비 %p</span></div><div class="table-scroll"><table class="rotation-table"><thead><tr><th>섹터 / ETF</th><th>최신 상태</th>${['1D','1W','1M'].map(p=>`<th class="${p===sectorPeriod?'sort-column':''}">${p}</th>`).join('')}</tr></thead><tbody>${sectors.map(s=>`<tr><td><div class="sector-name"><strong>${esc(s.korean)}</strong><span>${esc(s.name)} · ${esc(s.symbol)}</span></div></td><td><div class="state-badge ${esc(s.state)}">${stateLabels[s.state]||'→ 유지'}</div><small class="state-detail">${esc(s.detail)}</small></td>${['1D','1W','1M'].map(p=>{const n=s.periods[p];return `<td class="${p===sectorPeriod?'sort-column':''}"><strong class="${cls(n.return)}">${signed(n.return)}%</strong><small class="relative ${cls(n.relative)}">${signed(n.relative)}%p</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderDashboard(){renderSummary();renderFear();renderSectors();if(typeof renderHeatmap==='function')renderHeatmap();}
document.querySelectorAll('[data-sector-period]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.sectorPeriod===sectorPeriod));button.addEventListener('click',()=>{sectorPeriod=button.dataset.sectorPeriod;document.querySelectorAll('[data-sector-period]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});renderSectors();});});
async function loadBriefing(){
 try{const response=await fetch('data/briefing.json',{cache:'no-store'});if(!response.ok)throw new Error('No briefing data');const snapshot=await response.json();if(!Array.isArray(snapshot.sectors))throw new Error('Invalid briefing');briefing=snapshot;}catch(error){briefing={sectors:[],fearGreed:null};}
 renderDashboard();
}
renderDashboard();loadBriefing();loadNews();
