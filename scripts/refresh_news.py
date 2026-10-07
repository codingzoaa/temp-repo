"""Source-linked Korean morning briefing using public news RSS and observed prices."""
import datetime as dt
import email.utils
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from refresh_data import ROOT, get_chart

TOPICS = [
    ('korea','한국 주식','(코스피 OR 코스닥 OR 한국증시) when:1d',
     '외국인·기관 수급, 원/달러 환율, 반도체 대형주의 동반 상승 여부를 확인하세요.'),
    ('us','미국 주식','(미국증시 OR 뉴욕증시 OR 나스닥) when:1d',
     '주요 지수와 반도체의 동행 여부, 금리·VIX 변화, 실적 발표 일정을 확인하세요.'),
    ('ai','AI · 반도체','(인공지능 OR AI) (반도체 OR 엔비디아 OR HBM OR 실적 OR 투자) when:1d',
     'AI 투자 발표가 매출·수주·HBM 공급 증가로 이어지는지 확인하세요. 발표와 확정 계약은 구분해 보세요.'),
    ('datacenter','데이터센터 · 전력','(데이터센터 OR 데이터센터전력) (투자 OR 전력 OR 냉각 OR 수주 OR 증설) when:1d',
     '데이터센터 증설의 전력 확보, 냉각 설비, 실제 수주·가동 시점을 함께 확인하세요.'),
]

# Conditional industry context, separate from the headline's reported facts.
CONTEXT = [
 ('network',r'ASIC|커스텀|네트워크|광통신|마벨|브로드컴',
  'Custom ASIC · 네트워크','AI 가속기 다변화는 메모리뿐 아니라 고속 네트워크와 광통신 수요로 연결될 수 있습니다.',
  ['Broadcom','Marvell','Arista Networks'],'고객 집중도와 프로젝트 지연이 매출 변동성을 키울 수 있습니다.','계약 확정 여부와 실제 매출 가이던스 상향을 확인하세요.'),
 ('power',r'원전|전력|변압기|전력망|에너플렉스',
  '전력 · 인프라','전력 확보는 데이터센터의 가동 가능 시점을 좌우합니다. 장기 전력계약과 전력망 연결이 설비 투자 계획보다 먼저 확인돼야 합니다.',
  ['GE Vernova','Eaton','HD현대일렉트릭','효성중공업','LS ELECTRIC'],'전력 연결 지연과 전력 가격 상승은 데이터센터 운영 비용과 투자 회수 기간에 부담이 될 수 있습니다.','전력계약·수주잔고·가동 시점을 구분해 확인하세요.'),
 ('cooling',r'냉각|쿨링|액침|액체냉각',
  '냉각 · 열관리','AI 서버의 전력 밀도가 높아질수록 냉각 방식과 에너지 효율이 운영 비용에 중요해집니다.',
  ['Vertiv','LG전자'],'증설 계획이 실제 공급 계약으로 이어지지 않거나 투자 일정이 지연될 수 있습니다.','설비 공급 계약과 매출 인식 시점을 확인하세요.'),
 ('rates',r'금리|국채|연준|FOMC|유가',
  '금리 · 유동성','장기금리는 성장주의 할인율과 데이터센터 자금조달 비용에 영향을 줍니다. 금리 수준과 실제 주가 반응을 함께 봐야 합니다.',
  ['미국 성장주','데이터센터 개발·운영사'],'고금리가 지속되면 차입 비중이 높은 사업자의 이자 비용과 밸류에이션 부담이 커질 수 있습니다.','10년물 금리·VIX·성장주 상대강도를 함께 확인하세요.'),
 ('memory',r'HBM|메모리|하이닉스|삼전닉스|삼성|AMD|엔비디아|반도체',
  'GPU · HBM · 반도체','AI 반도체 협력과 투자 발표는 GPU·HBM·서버 공급망의 수요 가시성을 점검하는 출발점입니다. 협의와 확정 계약은 구분해야 합니다.',
  ['NVIDIA','AMD','삼성전자','SK하이닉스','Micron'],'고객 투자 계획 변경, 공급 증가, 실제 주문과 발표의 차이가 실적 위험이 될 수 있습니다.','HBM 주문·출하·수익성과 계약 확정 여부를 확인하세요.'),
 ('build',r'데이터센터|수주|증설',
  '데이터센터 · 건설','데이터센터 건설·수주는 서버뿐 아니라 전력·냉각 발주로 연결될 수 있습니다. 계획 규모보다 계약과 가동 시점의 확인이 중요합니다.',
  ['Vertiv','Eaton','전력기기·냉각 공급업체'],'전력·인허가·자금조달 지연으로 계획된 용량이 실제 가동되지 못할 수 있습니다.','계획 용량 → 전력 확보 → 인허가 → 실제 가동 순으로 점검하세요.'),
]

def context_for(title,key):
    mentioned=[]
    for pattern,name in [(r'HD건설기계','HD건설기계'),(r'현대엔지니어링','현대엔지니어링'),
                         (r'AMD','AMD'),(r'엔비디아|NVIDIA','NVIDIA'),
                         (r'삼성전자|삼전닉스','삼성전자'),(r'하이닉스|삼전닉스','SK하이닉스'),
                         (r'마벨|Marvell','Marvell'),(r'브로드컴|Broadcom','Broadcom')]:
        if re.search(pattern,title,re.I):mentioned.append(name)
    for theme,pattern,label,why,companies,risk,confirm in CONTEXT:
        if re.search(pattern,title,re.I):
            return {'theme':theme,'themeLabel':label,'why':why,'companies':list(dict.fromkeys(mentioned+companies))[:6],'risk':risk,'confirm':confirm}
    return {'theme':key,'themeLabel':'시장 흐름','why':'가격 움직임과 뉴스의 영향을 구분하고, 수급·실적 변화가 동반되는지 확인할 필요가 있습니다.',
            'companies':['기사에 언급된 기업·업종'],'risk':'단기 뉴스와 일시적인 수급이 장기 실적 개선을 의미하지는 않습니다.',
            'confirm':'기사 원문과 실적·수급 자료를 함께 확인하세요.'}

def relevance(title,key):
    patterns={'korea':r'코스피|코스닥|한국|국내|삼성|하이닉스|외국인',
              'us':r'미국|뉴욕|나스닥|월가|S&P|Nasdaq|엔비디아',
              'ai':r'AI|인공지능|반도체|HBM|엔비디아|AMD|하이닉스|삼성|브로드컴|마벨',
              'datacenter':r'데이터센터|전력|냉각|원전|변압기'}
    return bool(re.search(patterns[key],title,re.I))

def priority(title):
    return sum(weight for pattern,weight in [(r'실적|매출|가이던스|수주|계약',4),
           (r'금리|연준|정책|규제|전력',3),(r'HBM|AI|반도체|데이터센터|투자',2),
           (r'삼성|하이닉스|엔비디아|AMD|마벨|브로드컴',1)] if re.search(pattern,title,re.I))

def parse_feed(text, now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    result=[];seen=set()
    for item in ET.fromstring(text).findall('./channel/item'):
        title=html.unescape(item.findtext('title','')).strip()
        source=item.find('source')
        publisher=source.text.strip() if source is not None and source.text else '언론사 미제공'
        if title.endswith(' - '+publisher):title=title[:-(len(publisher)+3)]
        url=item.findtext('link','').strip()
        # Only accept the RSS provider's HTTPS article route, never a script URL.
        parsed=urllib.parse.urlparse(url)
        if parsed.scheme!='https' or parsed.hostname!='news.google.com':continue
        try:
            published=email.utils.parsedate_to_datetime(item.findtext('pubDate',''))
            if published.tzinfo is None:published=published.replace(tzinfo=dt.timezone.utc)
        except (TypeError,ValueError,OverflowError):continue
        age=(now-published).total_seconds()
        if age< -300 or age>48*3600:continue
        key=re.sub(r'\W','',title).lower()
        if not title or key in seen:continue
        seen.add(key)
        result.append({'title':title,'publisher':publisher,'url':url,'publishedAt':published.astimezone(dt.timezone.utc).isoformat()})
    result.sort(key=lambda article:article['publishedAt'],reverse=True)
    return result

def get_news(query,now=None):
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':query,'hl':'ko','gl':'KR','ceid':'KR:ko'})
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/rss+xml,application/xml'})
    with urllib.request.urlopen(request,timeout=25) as response:text=response.read().decode('utf-8')
    return parse_feed(text,now)

def main():
    now=dt.datetime.now(dt.timezone.utc)
    path=ROOT/'data/news.json'
    previous=json.loads(path.read_text()) if path.exists() else {}
    out={'schemaVersion':1,'generatedAt':now.isoformat(),'topics':[], 'koreaIndices':[], 'warnings':[],
         'method':'최근 24시간 검색 결과의 기사 제목 기반 브리핑 · 원문 링크 제공'}
    used=set()
    for key,label,query,checkpoint in TOPICS:
        try:
            candidates=get_news(query,now)
            candidates=[article for article in candidates if relevance(article['title'],key)]
            candidates.sort(key=lambda article:(priority(article['title']),article['publishedAt']),reverse=True)
            articles=[]
            for article in candidates:
                if article['url'] in used:continue
                articles.append({**article,'context':context_for(article['title'],key),'priority':priority(article['title'])})
                used.add(article['url'])
                if len(articles)==3:break
            if not articles:raise ValueError('최근 기사 없음')
            out['topics'].append({'key':key,'label':label,'articles':articles,'checkpoint':checkpoint})
        except Exception as error:
            old=next((topic for topic in previous.get('topics',[]) if topic['key']==key),None)
            out['topics'].append({**old,'cached':True} if old else
                                 {'key':key,'label':label,'articles':[],'checkpoint':checkpoint,'unavailable':True})
            out['warnings'].append(f'{label}: {error}')
    for symbol,name in [('^KS11','코스피'),('^KQ11','코스닥')]:
        try:out['koreaIndices'].append(get_chart(symbol,name,'index'))
        except Exception as error:out['warnings'].append(f'{name}: {error}')
    # Keep optional news failures visible without taking the market dashboard offline.
    if not out['koreaIndices'] and previous.get('koreaIndices'):
        out['koreaIndices']=previous['koreaIndices'];out['koreaQuotesCached']=True
    candidates=[{**article,'topic':topic['label'],'topicKey':topic['key'],'cached':topic.get('cached',False)}
                for topic in out['topics'] for article in topic['articles']]
    candidates.sort(key=lambda article:(article.get('priority',0),article['publishedAt']),reverse=True)
    priorities=[];seen_themes=set()
    for article in candidates:
        identity=(article['topicKey'],article.get('context',{}).get('theme'))
        if identity in seen_themes:continue
        seen_themes.add(identity);priorities.append(article)
        if len(priorities)==5:break
    out['priorities']=priorities
    out['valueChain']=[{'label':label,'count':sum(a.get('context',{}).get('theme')==key for a in candidates)}
                      for key,label in [('memory','GPU · HBM'),('network','ASIC · Network'),('power','Power'),
                                        ('cooling','Cooling'),('build','Data Center')]]
    temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(out,ensure_ascii=False,allow_nan=False),encoding='utf-8')
    os.replace(temporary,path)
    print('Briefing topics:',{topic['key']:len(topic['articles']) for topic in out['topics']})
    for warning in out['warnings']:print(warning)
    # Surface an entirely unavailable initial news run as a setup failure.
    return 0 if any(topic['articles'] for topic in out['topics']) else 1

if __name__=='__main__':sys.exit(main())
