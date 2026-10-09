let briefing={sectors:[],fearGreed:null};let sectorPeriod='1D';
const stateLabels={new:'🔥 신규 강세',strong:'↑ 강세 지속',steady:'→ 유지',weak:'↓ 약화'};
let modelBrief={available:false};
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
 const indices=data.indices||[],nas=indices.find(q=>q.symbol==='^IXIC'),sp=indices.find(q=>q.symbol==='^GSPC'),sox=indices.find(q=>q.symbol==='^SOX');
 const rate=data.rates?.tenYear,short=data.rates?.twoYear,assets=data.assets||[],oil=assets.find(q=>q.symbol==='CL=F');
 const topics=newsBrief.topics||[],articles=topics.flatMap(t=>t.articles||[]),lead=(newsBrief.priorities||[])[0];
 const sectorSymbols=['XLK','XLC','XLY','XLP','XLE','XLF','XLV','XLI','XLB','XLRE','XLU'];
 const sectors=(briefing.sectors||[]).filter(s=>sectorSymbols.includes(s.symbol)&&finite(s.periods?.['1D']?.return)).sort((a,b)=>b.periods['1D'].return-a.periods['1D'].return);
 const section=(label,title,body)=>`<section class="editorial-section ${label==='CLOSING MARKETS'?'closing-snapshot':''}"><span class="editorial-label">${label}</span><h3>${esc(title)}</h3>${body}</section>`;
 const quote=q=>q&&finite(q.price)?q.price.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+(q.kind==='yield'?'%':''):'—';
 const newsBlock=(pattern,limit=2)=>{const seen=new Set();const matched=articles.filter(a=>pattern.test(a.title)&&!seen.has(a.url)&&seen.add(a.url)).slice(0,limit);return matched.length?matched.map(a=>`<div class="brief-related"><p>${esc(a.title)}</p>${briefSource(a)}</div>`).join(''):'<p class="brief-empty">관련 보도 확인 대기 · 가격 변화만으로 원인을 단정하지 않습니다.</p>';};
 const market=sp&&nas?`미국 증시 ${sp.change>0&&nas.change>0?'동반 상승':sp.change<0&&nas.change<0?'동반 하락':'혼조 마감'}`:'마감 데이터 확인 중';
 let summary=sp&&nas?`${market}. 나스닥 ${signed(nas.change)}%, S&P 500 ${signed(sp.change)}%${sox?`, SOX ${signed(sox.change)}%`:''}. ${sectors.length?`${sectors[0].korean}가 섹터 ETF 중 가장 강했습니다.`:''}`:market;
 const rows=[{title:'금리',body:rate?`미국 10년물 ${quote(rate)} · 전일 대비 ${signed(rate.changePoints)}%p. 재무부 일별 공시값이며 장중 고점은 포함하지 않습니다.`:'금리 수집 대기',source:rate?.date||''},{title:'AI·반도체',body:sox&&nas?`SOX ${signed(sox.change)}% · 나스닥 대비 ${signed(sox.change-nas.change)}%p. ${sox.change>=nas.change?'반도체 상대 우위':'반도체 상대 부진'}.`:'반도체 관측 대기',source:sox?.date||''},{title:'유가',body:oil?`WTI 선물 ${quote(oil)}달러 · ${signed(oil.change)}%. 브렌트유 가격과는 다른 지표입니다.`:'WTI 수집 대기',source:oil?.date||''},{title:'시장 내부',body:sectors.length?`${sectors[0].korean} ${signed(sectors[0].periods['1D'].return)}%, ${sectors.at(-1).korean} ${signed(sectors.at(-1).periods['1D'].return)}%. 섹터 가격 흐름이며 실제 자금 유입액을 뜻하지 않습니다.`:'섹터 수집 대기',source:sectors[0]?.date||''}];
 const generated=modelBrief.available&&modelBrief.marketDate===sp?.date?modelBrief.content:null;
 if(generated){summary=generated.summary;['rates','ai','oil','breadth'].forEach((k,i)=>rows[i].body=generated[k]);}
 let result=section("TODAY'S SUMMARY",'오늘의 시장 한눈에 보기',`<div class="brief-key-summary"><b>핵심 요약</b><small class="brief-empty">${generated?'AI 작성 · 수집된 시세·뉴스 제목 기반':'관측 데이터 기반 요약'}</small><p>${esc(summary)}</p></div><ol class="editorial-summary">${rows.map(r=>`<li><div><h4>${r.title}</h4><p>${esc(r.body)}</p><small>${esc(r.source)}</small></div></li>`).join('')}</ol>${lead?`<div class="brief-related"><b>주요 보도</b><p>${esc(lead.title)}</p>${briefSource(lead)}</div>`:''}`);
 const ordered=['^IXIC','^GSPC','^SOX','^DJI','^RUT','^VIX'].map(s=>[...indices,...assets].find(q=>q.symbol===s));
 result+=section('CLOSING MARKETS','주요 지수 마감',`<div class="closing-date">${esc(sp?.date||'거래일 확인 중')} · 미국 거래일</div><p class="closing-note">전일 종가 대비 · 상승 초록 / 하락 빨강</p><div class="closing-quote-grid">${ordered.map((q,i)=>`<div><b>${['나스닥 종합','S&P 500','SOX','다우 존스','러셀 2000','VIX'][i]}</b><strong class="${q?cls(q.change):''}">${q&&finite(q.change)?signed(q.change)+'%':'—'}</strong><small>${quote(q)}</small></div>`).join('')}</div>`);
 const max=Math.max(1,...sectors.map(s=>Math.abs(s.periods['1D'].return))),zero=380;
 result+=section('SECTOR FOCUS','주요 섹터 등락',sectors.length?`<p>S&P 500 11개 섹터 ETF · ${esc(sectors[0].date)} · 전일 종가 대비</p><svg class="brief-sector-chart" viewBox="0 0 640 430" role="img" aria-label="S&P 500 11개 섹터 ETF 일간 등락 막대그래프"><line x1="${zero}" y1="10" x2="${zero}" y2="420" stroke="#aab2c4"/>${sectors.map((s,i)=>{const v=s.periods['1D'].return,len=Math.abs(v)/max*150,y=12+i*37;return `<text x="4" y="${y+20}" fill="currentColor" font-size="15">${esc(s.korean)} · ${s.symbol}</text><rect x="${v>=0?zero:zero-len}" y="${y}" width="${Math.max(len,1)}" height="26" rx="5" fill="${v>=0?'#16a085':'#ee5366'}"/><text x="${v>=0?zero+len+7:zero-len-7}" y="${y+19}" text-anchor="${v>=0?'start':'end'}" font-size="14" fill="currentColor">${signed(v)}%</text>`;}).join('')}</svg><p class="brief-empty">섹터 지수의 대용치로 ETF를 사용합니다. 반도체 ETF는 11개 섹터에 포함하지 않습니다.</p>`:'<p>11개 섹터 데이터 수집 대기</p>');
 const ai=data.aiStocks||[];
 const aiTrend=q=>{const h=(q.history||[]).slice(-22).filter(p=>finite(p.close));if(h.length<2)return '<small>이력 부족</small>';const lo=Math.min(...h.map(p=>p.close)),hi=Math.max(...h.map(p=>p.close));const pts=h.map((p,i)=>`${4+i/(h.length-1)*212},${52-(p.close-lo)/(hi-lo||1)*44}`).join(' ');return `<svg viewBox="0 0 220 60" role="img" aria-label="${esc(q.name)} 최근 1개월 종가 추이"><polyline points="${pts}" fill="none" stroke="#6260ef" stroke-width="2"/></svg>`;};
 result+=section('AI FOCUS','AI·반도체 집중 분석',`${sox&&nas?`<div class="brief-key-summary"><b>SOX ${quote(sox)} · <span class="${cls(sox.change)}">${signed(sox.change)}%</span></b><p>나스닥 ${signed(nas.change)}% 대비 <strong>${signed(sox.change-nas.change)}%p</strong> · ${sox.change>=nas.change?'반도체가 더 강했습니다':'반도체가 더 약했습니다'}.</p></div>`:'<p>SOX·나스닥 비교 데이터 대기</p>'}<p class="brief-empty">기업 추이: 최근 1개월 완료 종가</p><div class="brief-ai-stocks">${ai.map(q=>`<div><b>${esc(q.name)} <small>${esc(q.symbol)}</small></b><strong class="${cls(q.change)}">${signed(q.change)}%</strong><small>${quote(q)}달러 · ${esc(q.date)}</small>${aiTrend(q)}</div>`).join('')||'<p>주요 기업 시세 수집 대기</p>'}</div><h4>움직임의 배경 · 관련 보도</h4>${generated?`<p>${esc(generated.aiBackground)}</p>`:''}${newsBlock(/AI|인공지능|반도체|엔비디아|NVIDIA|AMD|마이크론|브로드컴|오라클/i,3)}<p class="brief-empty">보도와 주가 변화의 동시 관측이며, 개별 기업 등락의 확정 원인은 아닙니다.</p>`);
 const macro=[short,rate,oil,assets.find(q=>q.symbol==='GC=F'),assets.find(q=>q.symbol==='BTC-USD')];
 result+=section('RATES WATCH','채권·유가·원자재',`<div class="brief-macro-grid">${macro.map((q,i)=>`<div><b>${['미국 2년물 국채금리','미국 10년물 국채금리','WTI 선물','금 선물','비트코인'][i]}</b><strong>${quote(q)}${i>=2&&q?'달러':''}</strong><small class="${q?cls(q.change):''}">${q&&finite(q.change)?signed(q.kind==='yield'?q.changePoints:q.change)+(q.kind==='yield'?'%p':'%'):'—'} · ${esc(q?.date||'수집 대기')}</small></div>`).join('')}</div><h4>움직임의 배경 · 관련 보도</h4>${generated?`<p>${esc(generated.macroBackground)}</p>`:''}${newsBlock(/금리|국채|연준|유가|원유|중동|금값|비트코인/i,3)}<p class="brief-empty">금리는 미국 재무부 일별 공시값, 선물·비트코인은 Yahoo Finance 일별 종가입니다. 관측 시점이 서로 다를 수 있습니다.</p>`);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
 result+=section('DATA & SCHEDULE','오늘 한국·미국 주요 일정',`<p>${esc(today)} · 한국 시간 기준</p><div class="brief-calendar-country"><h4>한국</h4><a href="https://www.bok.or.kr/portal/main/main.do" target="_blank" rel="noopener noreferrer">한국은행 발표 일정 ↗</a><a href="https://kostat.go.kr/" target="_blank" rel="noopener noreferrer">국가데이터처 통계 발표 ↗</a><h4>미국</h4><a href="https://www.bls.gov/schedule/" target="_blank" rel="noopener noreferrer">고용·물가 발표 일정 ↗</a><a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" target="_blank" rel="noopener noreferrer">FOMC 일정 ↗</a></div><p class="brief-empty">오늘의 확정 경제지표·실적 일정과 발표 시각은 아직 자동 연동하지 않았습니다. 공식 일정 링크로 확인할 수 있습니다.</p><div class="editorial-insight"><b>마감 브리핑 자동 갱신</b><p>한국 시간 화~토 오전 7시 15분</p></div>`);
 return result;
}
function renderSummary(){
 document.querySelector('#market-summary').innerHTML=`<div class="briefing-heading"><div><div class="eyebrow">DAILY MARKET BRIEF</div><h2>미국 증시 마감 브리핑</h2></div><span class="brief-update">${newsBrief.generatedAt?'수집 '+esc(sourceTime(newsBrief.generatedAt))+' KST':'뉴스 연결 확인 중'}</span></div><div class="brief-carousel"><div class="brief-carousel-controls"><button type="button" data-brief-step="-1" aria-label="이전 카드">←</button><div class="brief-card-tabs" role="group" aria-label="브리핑 카드 선택"></div><button type="button" data-brief-step="1" aria-label="다음 카드">→</button></div><div class="brief-card-track" aria-label="옆으로 넘기는 시장 브리핑">${editorialBrief()}</div></div><details class="briefing-method"><summary>출처·요약 기준</summary><p>가격은 표시된 관측일의 완료 종가입니다. 뉴스는 무료 RSS에서 확인한 보도 제목을 중심으로 정리하며, 기사 본문 전체의 요약은 제공하지 않습니다. 시장 해석과 확인할 변수는 주제에 따른 일반적인 분석이며 확정된 수혜 판단이 아닙니다. 예시 이미지의 과거 수치·인용문·일정은 사용하지 않습니다. 섹터 카드는 11개 섹터 ETF의 일간 수익률입니다. 모델 API 키를 연결하면 수집된 시세·뉴스 제목 기반 AI 요약으로 갱신합니다.</p>${newsBrief.warnings?.length?`<p>수집 상태: ${esc(newsBrief.warnings.join(' / '))}</p>`:''}</details>`;
 setupBriefCards();
}
function setupBriefCards(){
 const track=document.querySelector('.brief-card-track');if(!track)return;
 const cards=[...track.querySelectorAll('.editorial-section')],tabs=document.querySelector('.brief-card-tabs');
 const names={'CLOSING MARKETS':'지수','AI FOCUS':'AI·반도체','GLOBAL HEADLINES':'글로벌 뉴스',"TODAY'S SUMMARY":'한눈에 보기',"TODAY'S ISSUE":'주요 이슈','SECTOR FOCUS':'섹터','RATES WATCH':'채권·자산','MARKET & AI BRIEF':'시장·AI','COMPANY NEWS':'기업','DATA & SCHEDULE':'일정'};
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
 const title=`<div class="sentiment-head"><div><div class="eyebrow">MARKET SENTIMENT</div><h2>Fear & Greed Index</h2></div><a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer">CNN 원문 ↗</a></div>`;
 if(!fg||!finite(fg.score)){el.innerHTML=title+'<div class="sentiment-missing"><strong>현재 CNN 지수를 가져올 수 없습니다</strong><p>CNN 데이터 응답이 복구되면 자동 갱신합니다.<br>원문 링크에서 최신 수치를 확인할 수 있습니다.</p></div>';return;}
 const labels={'extreme fear':'극단적 공포',fear:'공포',neutral:'중립',greed:'탐욕','extreme greed':'극단적 탐욕'};
 const label=labels[String(fg.rating).toLowerCase()]||(fg.score<=25?'극단적 공포':fg.score<=45?'공포':fg.score<=55?'중립':fg.score<=75?'탐욕':'극단적 탐욕');
 const timestamp=typeof fg.timestamp==='number'?(fg.timestamp<1e11?fg.timestamp*1000:fg.timestamp):fg.timestamp;
 const observation=new Date(timestamp);const stale=briefing.fearGreedCached||Date.now()-observation.getTime()>36*3600000;
 el.innerHTML=title+`<div class="sentiment-score"><strong>${Math.round(fg.score)}</strong><div><b>${esc(label)}</b><span>100점 기준 · ${stale?'최근 저장값':'CNN 관측값'}</span></div></div><div class="sentiment-gauge"><span style="left:${fg.score}%"></span></div><div class="gauge-labels"><span>극단적 공포</span><span>중립</span><span>극단적 탐욕</span></div><div class="sentiment-history">${[['전일',fg.previousClose],['1주 전',fg.previousWeek],['1개월 전',fg.previousMonth]].map(([l,n])=>`<span>${l} <b>${finite(n)?Math.round(n):'—'}</b></span>`).join('')}</div><p class="sentiment-date">관측 ${Number.isFinite(observation.getTime())?esc(observation.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})):'시각 미제공'} KST${stale?' · 최신 값 확인 필요':''}</p><p class="sentiment-chart-hint">카드를 눌러 1년 추이 보기 ↗</p>`;
}
function renderPutCall(){
 const el=document.querySelector('#put-call');if(!el)return;
 const item=briefing.fearGreed?.putCall;
 const heading='<div class="eyebrow">PUT AND CALL OPTIONS</div><h2>5-day average put/call ratio</h2><p class="put-call-subtitle">풋/콜 거래량 비율 · 5일 평균</p>';
 if(!item||!finite(item.ratio)){el.innerHTML=heading+'<p class="chart-unavailable">CNN 비율 데이터를 아직 가져오지 못했습니다.</p>';return;}
 const timestamp=new Date(item.timestamp),stale=item.cached||briefing.fearGreedCached||Date.now()-timestamp.getTime()>72*3600000;
 const labels={'extreme fear':'극단적 공포',fear:'공포',neutral:'중립',greed:'탐욕','extreme greed':'극단적 탐욕'};
 el.innerHTML=heading+`<div class="put-call-value"><strong>${item.ratio.toFixed(3)}</strong>${labels[item.rating]?`<span>${labels[item.rating]} · CNN</span>`:''}</div><p class="put-call-date">관측 ${esc(sourceTime(item.timestamp))} KST${stale?' · 최근 저장값':''}</p><p class="sentiment-chart-hint">카드를 눌러 1년 추이 보기 ↗</p><p class="put-call-explain">비율 상승은 콜 대비 풋 거래가 늘었음을 뜻합니다. 일반적으로 방어 수요 증가의 신호이며, 1을 넘으면 풋 거래가 더 많습니다.</p><a class="put-call-source" href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer">CNN 원문 ↗</a>`;
}
function renderSectors(){
 const sectors=[...(briefing.sectors||[])].sort((a,b)=>b.periods[sectorPeriod].relative-a.periods[sectorPeriod].relative);
 if(!sectors.length){document.querySelector('#sector-table').innerHTML='<p class="panel-note">섹터 데이터 수집 대기 중입니다.</p>';return;}
 document.querySelector('#sector-table').innerHTML=`<div class="rotation-note">정렬: ${sectorPeriod} SPY 대비 초과 수익률 · 관측 ${esc(sectors[0].date)} <span>표: ETF 수익률 · 상태 선택: SPY 대비 상세</span></div><div class="table-scroll"><table class="rotation-table"><thead><tr><th>섹터 / ETF</th><th>최신 상태</th>${['1D','1W','1M'].map(p=>`<th class="${p===sectorPeriod?'sort-column':''}">${p}</th>`).join('')}</tr></thead><tbody>${sectors.map(s=>`<tr><td><div class="sector-name"><strong>${esc(s.korean)}</strong><span>${esc(s.name)} · ${esc(s.symbol)}</span></div></td><td><details class="sector-context"><summary class="state-badge ${esc(s.state)}">${stateLabels[s.state]||'→ 유지'}</summary><div><b>${esc(s.detail)}</b>${['1D','1W','1M'].map(p=>`<p>${p} · SPY 대비 ${signed(s.periods[p].relative)}%p</p>`).join('')}</div></details></td>${['1D','1W','1M'].map(p=>{const n=s.periods[p];return `<td class="${p===sectorPeriod?'sort-column':''}" title="SPY 대비 ${signed(n.relative)}%p"><strong class="${cls(n.return)}">${signed(n.return)}%</strong></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderDashboard(){renderSummary();renderFear();renderPutCall();renderSectors();if(typeof renderHeatmap==='function')renderHeatmap();}
document.querySelectorAll('[data-sector-period]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.sectorPeriod===sectorPeriod));button.addEventListener('click',()=>{sectorPeriod=button.dataset.sectorPeriod;document.querySelectorAll('[data-sector-period]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});renderSectors();});});
async function loadBriefing(){
 try{const response=await fetch('data/briefing.json',{cache:'no-store'});if(!response.ok)throw new Error('No briefing data');const snapshot=await response.json();if(!Array.isArray(snapshot.sectors))throw new Error('Invalid briefing');briefing=snapshot;}catch(error){briefing={sectors:[],fearGreed:null};}
 renderDashboard();
}
renderDashboard();loadBriefing();loadNews();

async function loadEditorial(){try{const r=await fetch("data/editorial.json",{cache:"no-store"});if(!r.ok)return;const item=await r.json();const keys=["summary","rates","ai","oil","breadth","aiBackground","macroBackground"];if(item.available&&keys.every(k=>typeof item.content?.[k]==="string"))modelBrief=item;}catch{}renderSummary();}
loadEditorial();
