let quoteChartItem=null;let quoteChartPeriod='3M';
function detailedChart(points,{name,unit='',fixedScale=false,decimals=2,width=typeof window==='undefined'?700:Math.max(300,Math.min(700,window.innerWidth-90))}={}){
 const valid=(points||[]).filter(p=>finite(p.close)&&Number.isFinite(Date.parse(p.date)));
 if(valid.length<2)return '<p class="chart-unavailable">표시할 과거 관측 데이터가 부족합니다.</p>';
 const values=valid.map(p=>p.close),low=fixedScale?0:Math.min(...values),high=fixedScale?100:Math.max(...values),padding=fixedScale?0:(high-low||Math.abs(high)*.01||1)*.08;
 const min=low-padding,max=high+padding,first=Date.parse(valid[0].date),last=Date.parse(valid.at(-1).date);
 const format=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:decimals})+unit;
 const xy=p=>[55+(Date.parse(p.date)-first)/(last-first||1)*(width-75),215-(p.close-min)/(max-min||1)*190];
 const coords=valid.map(p=>xy(p));
 return `<div class="detail-chart" data-chart-points="${esc(JSON.stringify(valid))}" data-chart-unit="${esc(unit)}" data-chart-width="${width}" data-chart-decimals="${decimals}"><div class="detail-chart-readout">${esc(valid.at(-1).date)} · ${esc(format(valid.at(-1).close))}</div><svg viewBox="0 0 ${width} 245" preserveAspectRatio="none" role="img" aria-label="${esc(name)} ${esc(valid[0].date)}부터 ${esc(valid.at(-1).date)} 추이">${[min,(min+max)/2,max].map(n=>{const y=215-(n-min)/(max-min||1)*190;return `<path d="M55 ${y}H${width-20}" stroke="#e7ebf4"/><text x="2" y="${y+4}">${esc(format(n))}</text>`;}).join('')}<polyline points="${coords.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#7162ec" stroke-width="2.4" vector-effect="non-scaling-stroke"/>${valid.map((p,i)=>`<circle cx="${coords[i][0]}" cy="${coords[i][1]}" r="2" fill="#7162ec"><title>${esc(p.date)} · ${esc(format(p.close))}</title></circle>`).join('')}</svg><div class="detail-chart-range"><span>${esc(valid[0].date)}</span><span>${valid.length}개 관측</span><span>${esc(valid.at(-1).date)}</span></div></div>`;
}
function showQuoteChart(){
 const item=quoteChartItem;if(!item)return;
 document.querySelector('#quote-chart-title').textContent=item.name;
 document.querySelector('#quote-chart-source').textContent=`${item.symbol} · ${item.source||'Yahoo Finance'} · ${item.date} 기준`;
 const history=item.history||[];const end=Date.parse(history.at(-1)?.date),days={'1M':31,'3M':92,'1Y':365}[quoteChartPeriod];
 const points=history.filter(p=>Date.parse(p.date)>=end-days*86400000);
 document.querySelector('#quote-chart-content').innerHTML=`<div class="quote-detail-returns">${[[5,'1주'],[21,'1개월'],[63,'3개월']].map(([n,label])=>{const value=periodValue(item,n);return `<span>${label} <b class="${cls(value)}">${signed(value)}${finite(value)?item.kind==='yield'?'%p':'%':''}</b></span>`;}).join('')}</div>`+detailedChart(points,{name:item.name,unit:item.kind==='yield'?'%':item.kind==='usd'?' USD':''});
 document.querySelectorAll('[data-chart-period]').forEach(b=>{const selected=b.dataset.chartPeriod===quoteChartPeriod;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
function openQuoteChart(symbol){document.querySelector('.quote-chart-periods').hidden=false;const item=[...(data.indices||[]),...(data.assets||[]),...Object.values(data.rates||{})].find(s=>s?.symbol===symbol);if(!item)return;quoteChartItem=item;quoteChartPeriod='3M';showQuoteChart();document.querySelector('#quote-chart-dialog').showModal();}
document.addEventListener('click',event=>{
 const card=event.target.closest('[data-chart-symbol]');if(card){openQuoteChart(card.dataset.chartSymbol);return;}
 const sentiment=event.target.closest('[data-sentiment-chart]');if(sentiment&&!event.target.closest('a')){openSentimentChart(sentiment.dataset.sentimentChart);return;}
 const period=event.target.closest('[data-chart-period]');if(period){quoteChartPeriod=period.dataset.chartPeriod;showQuoteChart();}
});
document.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;if(event.target.matches('[data-chart-symbol]')){event.preventDefault();openQuoteChart(event.target.dataset.chartSymbol);}else if(event.target.matches('[data-sentiment-chart]')){event.preventDefault();openSentimentChart(event.target.dataset.sentimentChart);}});

document.querySelector('#close-quote-chart').addEventListener('click',()=>document.querySelector('#quote-chart-dialog').close());
function chartPointer(event){const chart=event.target.closest('.detail-chart');if(!chart)return;const svg=chart.querySelector('svg'),rect=svg.getBoundingClientRect(),points=JSON.parse(chart.dataset.chartPoints);const fraction=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*Number(chart.dataset.chartWidth)-55)/(Number(chart.dataset.chartWidth)-75)));const first=Date.parse(points[0].date),last=Date.parse(points.at(-1).date),date=first+fraction*(last-first);const point=points.reduce((best,p)=>Math.abs(Date.parse(p.date)-date)<Math.abs(Date.parse(best.date)-date)?p:best);chart.querySelector('.detail-chart-readout').textContent=`${point.date} · ${point.close.toLocaleString('ko-KR',{maximumFractionDigits:Number(chart.dataset.chartDecimals)})}${chart.dataset.chartUnit}`;}
document.addEventListener('pointermove',chartPointer);document.addEventListener('pointerdown',chartPointer);

function openSentimentChart(key){
 const fg=briefing.fearGreed,item=key==='fear'?fg:fg?.putCall;
 const name=key==='fear'?'Fear & Greed Index':'5-day average put/call ratio';
 quoteChartItem=null;
 document.querySelector('#quote-chart-title').textContent=name+' · 1년 추이';
 document.querySelector('#quote-chart-source').textContent='CNN · 일별 실제 관측값';
 document.querySelector('.quote-chart-periods').hidden=true;
 const history=item?.history||[],end=Date.parse(history.at(-1)?.date);
 const points=history.filter(p=>Date.parse(p.date)>=end-365*86400000);
 document.querySelector('#quote-chart-content').innerHTML=detailedChart(points,{name,fixedScale:key==='fear',decimals:key==='fear'?0:3});
 document.querySelector('#quote-chart-dialog').showModal();
}
