import datetime as dt
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('refresh', Path(__file__).resolve().parents[1] / 'scripts/refresh_data.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

def payload(count=260):
    start = dt.datetime(2025, 1, 1, 15, tzinfo=dt.timezone.utc)
    return {'chart': {'result': [{'meta': {'exchangeTimezoneName': 'America/New_York'},
        'timestamp': [int((start + dt.timedelta(days=i)).timestamp()) for i in range(count)],
        'indicators': {'quote': [{'close': list(range(100,100+count)), 'volume': [1000]*count}],
                       'adjclose': [{'adjclose': list(range(100,100+count))}]}}], 'error': None}}

class CollectorTests(unittest.TestCase):
    def test_treasury_thirty_year_and_missing_observation(self):
        xml='<feed>'+''.join(f'<entry><NEW_DATE>2026-10-0{i}</NEW_DATE><BC_2YEAR>4.7</BC_2YEAR><BC_10YEAR>5.2</BC_10YEAR>{extra}</entry>' for i,extra in [(5,'<BC_30YEAR>5.4</BC_30YEAR>'),(6,''),(7,'<BC_30YEAR>5.5</BC_30YEAR>')])+'</feed>'
        with patch.object(refresh,'fetch_text',return_value=xml):
            rates=refresh.treasury_rates()
        self.assertEqual(rates['thirtyYear']['symbol'],'Y30')
        self.assertEqual(len(rates['thirtyYear']['history']),2)
        self.assertEqual(rates['thirtyYear']['date'],'2026-10-07')
        self.assertAlmostEqual(rates['thirtyYear']['changePoints'],.1)
        self.assertEqual(len(rates['tenYear']['history']),3)

    def test_number(self):
        self.assertEqual(refresh.number('$1,234.50'),1234.5)
        self.assertEqual(refresh.number('10B'),10e9)
        self.assertIsNone(refresh.number('N/A'))
        self.assertIsNone(refresh.number(float('nan')))

    def test_completed_bars_and_high(self):
        p=payload()
        last=dt.datetime.fromtimestamp(p['chart']['result'][0]['timestamp'][-1],dt.timezone.utc)
        record=refresh.parse_chart(p,'TEST','Test',now=last)
        self.assertEqual(record['price'],358)  # Current day (359) excluded.
        self.assertTrue(record['newHigh'])
        self.assertEqual(len(record['history']),259)  # Keep additional history for historical breadth.
        self.assertAlmostEqual(record['monthReturn'],(358/337-1)*100)
        self.assertAlmostEqual(record['change'],(358/357-1)*100)

    def test_high_uses_adjusted_history(self):
        p=payload()
        p['chart']['result'][0]['indicators']['adjclose'][0]['adjclose'][-2]=1
        record=refresh.parse_chart(p,'TEST','Test',now=dt.datetime(2027,1,1,tzinfo=dt.timezone.utc))
        self.assertTrue(record['newHigh'])
        p['chart']['result'][0]['indicators']['adjclose'][0]['adjclose'][-1]=10
        self.assertFalse(refresh.parse_chart(p,'TEST','Test',now=dt.datetime(2027,1,1,tzinfo=dt.timezone.utc))['newHigh'])

    def test_morning_kst_includes_closed_us_session(self):
        p=payload()
        last=dt.datetime.fromtimestamp(p['chart']['result'][0]['timestamp'][-1],dt.timezone.utc)
        after_close=last.replace(hour=22,minute=15)
        self.assertEqual(refresh.parse_chart(p,'TEST','Test',now=after_close)['price'],359)
        self.assertEqual(refresh.parse_chart(p,'BTC-USD','Bitcoin',now=after_close)['price'],358)

    def test_winter_morning_kst_includes_close(self):
        p=payload(7)
        now=dt.datetime(2025,1,7,22,15,tzinfo=dt.timezone.utc)
        self.assertEqual(refresh.parse_chart(p,'TEST','Test',now=now)['price'],106)

    def test_insufficient_history_is_not_high(self):
        record=refresh.parse_chart(payload(20),'IPO','New',now=dt.datetime(2027,1,1,tzinfo=dt.timezone.utc))
        self.assertFalse(record['newHigh'])
        self.assertFalse(record['highHistoryComplete'])
        self.assertIsNone(record['monthReturn'])

    def test_error_not_hidden(self):
        with self.assertRaises(ValueError):
            refresh.parse_chart({'chart':{'result':None,'error':{'code':'Not Found'}}},'NONE','None')

    def test_share_class_symbol_mapping_and_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(refresh,'ROOT',Path(directory)),patch.object(refresh,'fetch',return_value=payload()) as fetch:
                record=refresh.get_chart('BRK/B','Berkshire')
                self.assertIn('/BRK-B?',fetch.call_args.args[0])
                self.assertEqual(record['symbol'],'BRK/B')
                refresh.get_chart('BRK/B','Berkshire')
                self.assertEqual(fetch.call_count,1)

    def test_screener_download_and_missing_volume(self):
        responses=[{'data':{'totalrecords':2}},
                   {'data':{'asOf':'test','rows':[{'symbol':'AAA','name':'A','lastsale':'$10','volume':'1,000','marketCap':'10B'},
                      {'symbol':'BBB','name':'B','lastsale':'$20','volume':'N/A','marketCap':'9B'}]}}]
        with patch.object(refresh,'fetch',side_effect=responses):
            records=refresh.screener()
        self.assertEqual(records[0]['turnover'],10000)
        self.assertIsNone(records[1]['turnover'])
        self.assertEqual(records[0]['marketCap'],10e9)

    def test_incomplete_download_fails(self):
        with patch.object(refresh,'fetch',side_effect=[{'data':{'totalrecords':2}},{'data':{'rows':[{'symbol':'AAA'}]}}]):
            with self.assertRaises(ValueError):
                refresh.screener()

    def test_breadth_and_regime(self):
        candidates=[
            {'change':1.0,'history':[{}]*253,'above20':True,'above50':True,'above200':True,'newHigh':True,'newLow':False},
            {'change':-1.0,'history':[{}]*253,'above20':False,'above50':False,'above200':False,'newHigh':False,'newLow':True},
            {'change':2.0,'history':[{}]*253,'above20':True,'above50':True,'above200':True,'newHigh':False,'newLow':False},
        ]
        breadth=refresh.build_breadth(candidates)
        self.assertEqual(breadth['advancers'],2)
        self.assertEqual(breadth['decliners'],1)
        self.assertAlmostEqual(breadth['above50'],200/3)
        out={'indices':[{'symbol':'^IXIC','change':1},{'symbol':'^SOX','change':2}],
             'assets':[{'symbol':'^VIX','change':-3}],
             'breadth':breadth,'rates':{'tenYear':{'change':0.05}}}
        regime=refresh.build_regime(out)
        self.assertEqual(regime['label'],'RISK ON')
        self.assertIn('반도체',regime['summary'])

    def test_failed_run_preserves_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'data').mkdir();snapshot=root/'data/market.json';snapshot.write_text('last good data')
            with patch.object(refresh,'ROOT',root),patch.object(refresh,'get_chart',side_effect=RuntimeError('blocked')),patch.object(refresh,'screener',side_effect=RuntimeError('blocked')),patch.object(refresh,'treasury_rates',side_effect=RuntimeError('blocked')):
                self.assertEqual(refresh.main(),1)
            self.assertEqual(snapshot.read_text(),'last good data')

if __name__=='__main__':
    unittest.main()
