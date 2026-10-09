let heatmapPeriod='1D';let heatmapExpanded=false;let selectedHeatmapSymbol=null;
const heatmapScales={'1D':3,'1W':5,'1M':10};
function heatmapReturn(stock){const value=stock.periods?.[heatmapPeriod]?.return;return finite(value)?value:heatmapPeriod==='1D'&&!stock.periods?stock.change:null;}
// Binary treemap: every rectangle's area is proportional to market capitalization.
function mapLayout(items,x,y,width,height){
 if(!items.length)return [];
 if(items.length===1)return [{item:items[0],x,y,width,height}];
 const total=items.reduce((sum,i)=>sum+i.weight,0);let sum=0,split=1;
 for(let i=0;i<items.length-1;i++){sum+=items[i].weight;split=i+1;if(sum>=total/2)break;}
 const ratio=items.slice(0,split).reduce((n,i)=>n+i.weight,0)/total;
 return width>=height?[...mapLayout(items.slice(0,split),x,y,width*ratio,height),...mapLayout(items.slice(split),x+width*ratio,y,width*(1-ratio),height)]:[...mapLayout(items.slice(0,split),x,y,width,height*ratio),...mapLayout(items.slice(split),x,y+height*ratio,width,height*(1-ratio))];
}
function mapColor(change,limit=3){if(change===null||change===undefined||!Number.isFinite(change))return '#363e4a';const c=Math.max(-limit,Math.min(limit,change));const start=[54,62,74],end=c>=0?[22,134,83]:[163,44,65],t=Math.abs(c)/limit;return `rgb(${start.map((n,i)=>Math.round(n+(end[i]-n)*t)).join(',')})`;}
function renderHeatmap(){
 const container=document.querySelector('#heatmap-map');if(!container)return;
 const stocks=(data.heatmapUniverse?.scope==='S&P 500'?data.heatmap||[]:[]).filter(s=>finite(s.marketCap)&&s.marketCap>0&&finite(s.price));
 if(!stocks.length){container.innerHTML='<p class="panel-note">히트맵 데이터 수집 대기 중입니다. 다음 일별 갱신에서 제공됩니다.</p>';return;}
 const grouped=new Map();for(const s of stocks){const label=s.sector||'미분류';if(!grouped.has(label))grouped.set(label,[]);grouped.get(label).push(s);}
 const groups=[...grouped].map(([name,rows])=>({name,rows,weight:rows.reduce((sum,s)=>sum+s.marketCap,0)})).sort((a,b)=>b.weight-a.weight);
 const width=container.clientWidth||1000,height=heatmapExpanded?(width<600?800:600):(width<600?380:320);container.style.height=height+'px';
 document.querySelector('#heatmap-meta').textContent=`S&P 500 · ${stocks.length}/${data.heatmapUniverse.members}개 주식 클래스 · 면적: 시총 · 색: ${heatmapPeriod} 수익률 (수정 종가) · ${stocks.filter(s=>finite(heatmapReturn(s))).length}개 기간 수익률 제공 · GICS 섹터 · 공개 구성 목록 · 관측 ${[...new Set(stocks.map(s=>s.date))].sort().join(' / ')} · 일별 갱신${stocks.length<data.heatmapUniverse.members?' · 일부 시세/시총 미제공':''}`;

 container.innerHTML=mapLayout(groups,0,0,width,height).map(g=>{const tiles=mapLayout(g.item.rows.map(s=>({...s,weight:s.marketCap})).sort((a,b)=>b.weight-a.weight),0,0,Math.max(1,g.width-4),Math.max(1,g.height-25));return `<section class="map-sector" style="left:${g.x}px;top:${g.y}px;width:${g.width}px;height:${g.height}px"><h3 title="${esc(g.item.name)}">${esc(g.item.name)}</h3><div class="map-tiles">${tiles.map(t=>{const s=t.item,value=heatmapReturn(s),visible=t.width>=35&&t.height>=27;const label=`${s.symbol} · ${s.name} · ${heatmapPeriod} ${finite(value)?signed(value)+'%':'이력 부족'} · ${s.date}`;return `<button class="map-tile" data-symbol="${esc(s.symbol)}" aria-label="${esc(label)}" title="${esc(label)}" style="left:${t.x}px;top:${t.y}px;width:${t.width}px;height:${t.height}px;background:${mapColor(value,heatmapScales[heatmapPeriod])};font-size:${Math.max(9,Math.min(29,t.width/5,t.height/3))}px">${visible?`<b>${esc(s.symbol)}</b>${t.height>42&&t.width>45?`<span>${finite(value)?signed(value)+'%':'—'}</span>`:''}`:''}</button>`;}).join('')}</div></section>`;}).join('');
 const showDetail=s=>{const value=heatmapReturn(s),p=s.periods?.[heatmapPeriod];document.querySelector('#heatmap-detail').textContent=`${s.symbol} · ${s.name} | ${money(s.price)} | ${heatmapPeriod} ${finite(value)?signed(value)+'%':'이력 부족'} | 시총 ${scale(s.marketCap)} | ${s.sector||'미분류'}${s.industry?' · '+s.industry:''} | ${p?.startDate?p.startDate+' → ':''}${s.date} 종가`;};
 container.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{selectedHeatmapSymbol=button.dataset.symbol;showDetail(stocks.find(s=>s.symbol===selectedHeatmapSymbol));}));
 if(selectedHeatmapSymbol){const s=stocks.find(s=>s.symbol===selectedHeatmapSymbol);if(s)showDetail(s);}
 const limit=heatmapScales[heatmapPeriod];document.querySelector('.heatmap-legend').innerHTML=[-limit,-limit/3,0,limit/3,limit].map((n,i)=>`<span style="background:${mapColor(n,limit)}">${signed(n)}%${i===0?' 이하':i===4?' 이상':''}</span>`).join('');
}
document.querySelectorAll('[data-heatmap-period]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.heatmapPeriod===heatmapPeriod));button.addEventListener('click',()=>{heatmapPeriod=button.dataset.heatmapPeriod;document.querySelectorAll('[data-heatmap-period]').forEach(b=>{const selected=b.dataset.heatmapPeriod===heatmapPeriod;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});renderHeatmap();});});
document.querySelector('#heatmap-expand')?.addEventListener('click',()=>{heatmapExpanded=!heatmapExpanded;const button=document.querySelector('#heatmap-expand');button.setAttribute('aria-expanded',String(heatmapExpanded));button.textContent=heatmapExpanded?'히트맵 접기':'전체 히트맵 보기';renderHeatmap();});
renderHeatmap();if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>renderHeatmap()).observe(document.querySelector('#heatmap-map'));
