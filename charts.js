let fearExpanded=false;let quoteChartItem=null;let quoteChartPeriod='3M';
function detailedChart(points,{name,unit='',fixedScale=false,width=typeof window==='undefined'?700:Math.max(300,Math.min(700,window.innerWidth-90))}={}){
 const valid=(points||[]).filter(p=>finite(p.close)&&Number.isFinite(Date.parse(p.date)));
 if(valid.length<2)return '<p class="chart-unavailable">표시할 과거 관측 데이터가 부족합니다.</p>';
 const values=valid.map(p=>p.close),low=fixedScale?0:Math.min(...values),high=fixedScale?100:Math.max(...values),padding=fixedScale?0:(high-low||Math.abs(high)*.01||1)*.08;
 const min=low-padding,max=high+padding,first=Date.parse(valid[0].date),last=Date.parse(valid.at(-1).date);
 const format=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2})+unit;
 const xy=p=>[55+(Date.parse(p.date)-first)/(last-first||1)*(width-75),215-(p.close-min)/(max-min||1)*190];
 const coords=valid.map(p=>xy(p));
 return `<div class="detail-chart" data-chart-points="${esc(JSON.stringify(valid))}" data-chart-unit="${esc(unit)}" data-chart-width="${width}"><div class="detail-chart-readout">${esc(valid.at(-1).date)} · ${esc(format(valid.at(-1).close))}</div><svg viewBox="0 0 ${width} 245" preserveAspectRatio="none" role="img" aria-label="${esc(name)} ${esc(valid[0].date)}부터 ${esc(valid.at(-1).date)} 추이">${[min,(min+max)/2,max].map(n=>{const y=215-(n-min)/(max-min||1)*190;return `<path d="M55 ${y}H${width-20}" stroke="#e7ebf4"/><text x="2" y="${y+4}">${esc(format(n))}</text>`;}).join('')}<polyline points="${coords.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#7162ec" stroke-width="2.4" vector-effect="non-scaling-stroke"/>${valid.map((p,i)=>`<circle cx="${coords[i][0]}" cy="${coords[i][1]}" r="2" fill="#7162ec"><title>${esc(p.date)} · ${esc(format(p.close))}</title></circle>`).join('')}</svg><div class="detail-chart-range"><span>${esc(valid[0].date)}</span><span>${valid.length}개 관측</span><span>${esc(valid.at(-1).date)}</span></div></div>`;
}
function fearHistoryMarkup(fg){return `<details class="fear-history" ${fearExpanded?'open':''}><summary>1년 추이 보기</summary>${detailedChart(fg.history,{name:'CNN Fear & Greed Index',fixedScale:true,width:300})}<p>0: 극단적 공포 · 100: 극단적 탐욕 · CNN 실제 관측값</p></details>`;}
function showQuoteChart(){
 const item=quoteChartItem;if(!item)return;
 document.querySelector('#quote-chart-title').textContent=item.name;
 document.querySelector('#quote-chart-source').textContent=`${item.symbol} · ${item.source||'Yahoo Finance'} · ${item.date} 기준`;
 const history=item.history||[];const end=Date.parse(history.at(-1)?.date),days={'1M':31,'3M':92,'1Y':365}[quoteChartPeriod];
 const points=history.filter(p=>Date.parse(p.date)>=end-days*86400000);
 document.querySelector('#quote-chart-content').innerHTML=detailedChart(points,{name:item.name,unit:item.kind==='yield'?'%':item.kind==='usd'?' USD':''});
 document.querySelectorAll('[data-chart-period]').forEach(b=>{const selected=b.dataset.chartPeriod===quoteChartPeriod;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
function openQuoteChart(symbol){const item=[...(data.indices||[]),...(data.assets||[]),...Object.values(data.rates||{})].find(s=>s?.symbol===symbol);if(!item)return;quoteChartItem=item;quoteChartPeriod='3M';showQuoteChart();document.querySelector('#quote-chart-dialog').showModal();}
document.addEventListener('click',event=>{
 const card=event.target.closest('[data-chart-symbol]');if(card){openQuoteChart(card.dataset.chartSymbol);return;}
 if(event.target.closest('#fear-greed')&&!event.target.closest('a,.fear-history')&&document.querySelector('[data-fear-toggle]')){fearExpanded=!fearExpanded;const detail=document.querySelector('.fear-history');if(detail)detail.open=fearExpanded;document.querySelector('[data-fear-toggle]').setAttribute('aria-expanded',String(fearExpanded));}
 const period=event.target.closest('[data-chart-period]');if(period){quoteChartPeriod=period.dataset.chartPeriod;showQuoteChart();}
});
document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('[data-chart-symbol]')){event.preventDefault();openQuoteChart(event.target.dataset.chartSymbol);}});
document.addEventListener('toggle',event=>{if(event.target.matches?.('.fear-history')){fearExpanded=event.target.open;document.querySelector('[data-fear-toggle]')?.setAttribute('aria-expanded',String(fearExpanded));}},true);
document.querySelector('#close-quote-chart').addEventListener('click',()=>document.querySelector('#quote-chart-dialog').close());
function chartPointer(event){const chart=event.target.closest('.detail-chart');if(!chart)return;const svg=chart.querySelector('svg'),rect=svg.getBoundingClientRect(),points=JSON.parse(chart.dataset.chartPoints);const fraction=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*Number(chart.dataset.chartWidth)-55)/(Number(chart.dataset.chartWidth)-75)));const first=Date.parse(points[0].date),last=Date.parse(points.at(-1).date),date=first+fraction*(last-first);const point=points.reduce((best,p)=>Math.abs(Date.parse(p.date)-date)<Math.abs(Date.parse(best.date)-date)?p:best);chart.querySelector('.detail-chart-readout').textContent=`${point.date} · ${point.close.toLocaleString('ko-KR',{maximumFractionDigits:2})}${chart.dataset.chartUnit}`;}
document.addEventListener('pointermove',chartPointer);document.addEventListener('pointerdown',chartPointer);
