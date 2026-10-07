import datetime as dt
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh_news import parse_feed, context_for, relevance, priority

NOW=dt.datetime(2026,10,8,0,0,tzinfo=dt.timezone.utc)

def item(title='시장 뉴스 - Example',url='https://news.google.com/rss/articles/test',date='Wed, 07 Oct 2026 20:00:00 GMT'):
    return f'<item><title>{title}</title><link>{url}</link><pubDate>{date}</pubDate><source>Example</source></item>'

class NewsTests(unittest.TestCase):
    def parse(self,items):return parse_feed('<rss><channel>'+items+'</channel></rss>',NOW)

    def test_source_and_date_preserved(self):
        result=self.parse(item())
        self.assertEqual(result[0]['title'],'시장 뉴스')
        self.assertEqual(result[0]['publisher'],'Example')
        self.assertEqual(result[0]['publishedAt'],'2026-10-07T20:00:00+00:00')

    def test_duplicates_removed(self):self.assertEqual(len(self.parse(item()+item())),1)

    def test_old_and_future_news_excluded(self):
        self.assertEqual(self.parse(item(date='Sun, 04 Oct 2026 20:00:00 GMT')),[])
        self.assertEqual(self.parse(item(date='Fri, 09 Oct 2026 20:00:00 GMT')),[])

    def test_unsafe_and_foreign_links_excluded(self):
        self.assertEqual(self.parse(item(url='javascript:alert(1)')),[])
        self.assertEqual(self.parse(item(url='https://example.com/phish')),[])

    def test_invalid_date_not_invented(self):self.assertEqual(self.parse(item(date='not a date')),[])

    def test_latest_first(self):
        result=self.parse(item(title='Later')+item(title='Earlier',date='Wed, 07 Oct 2026 10:00:00 GMT'))
        self.assertEqual(result[0]['title'],'Later')

    def test_issue_priority_prefers_contracts_over_generic_market(self):
        self.assertGreater(priority('AI 데이터센터 수주 계약'),priority('시장 소식'))

    def test_topic_relevance(self):
        self.assertFalse(relevance('박스권 갇힌 코스피','ai'))
        self.assertTrue(relevance('AMD AI 반도체 협력','ai'))

    def test_conditional_context_matches_power(self):
        result=context_for('데이터센터 전력 공급 계약','datacenter')
        self.assertEqual(result['theme'],'power')
        self.assertIn('Eaton',result['companies'])
        self.assertTrue(result['risk'])

    def test_unknown_theme_has_no_invented_company(self):
        result=context_for('오늘 시장 흐름','korea')
        self.assertEqual(result['companies'],['기사에 언급된 기업·업종'])

if __name__=='__main__':unittest.main()
