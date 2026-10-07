import sys
from pathlib import Path
import unittest
from unittest.mock import patch
import io
import json

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh_briefing import rotation, sentiment

def record(symbol,changes):
    price=100
    history=[{'date':'000','close':price,'adjusted':price}]
    for i,value in enumerate(changes,1):
        price*=1+value/100
        history.append({'date':str(i).zfill(3),'close':price,'adjusted':price})
    return {'symbol':symbol,'history':history,'date':history[-1]['date']}

class RotationTests(unittest.TestCase):
    def compare(self,changes):
        return rotation(record('ETF',changes),record('SPY',[0]*len(changes)))

    def test_new_strength(self):
        self.assertEqual(self.compare([0]*20+[-1,1])['state'],'new')

    def test_continuing_strength(self):
        result=self.compare([.1]*22)
        self.assertEqual(result['state'],'strong')
        self.assertEqual(result['streak'],22)
        self.assertAlmostEqual(result['periods']['1W']['relative'],((1.001**5)-1)*100)

    def test_weakening(self):
        self.assertEqual(self.compare([0]*20+[-.1,-.2])['state'],'weak')

    def test_steady(self):
        self.assertEqual(self.compare([0]*22)['state'],'steady')

    def test_benchmark_date_mismatch(self):
        own=record('ETF',[0]*22);benchmark=record('SPY',[0]*23)
        with self.assertRaises(ValueError):rotation(own,benchmark)

    def test_returns_align_dates(self):
        own=record('ETF',[1]*22);benchmark=record('SPY',[.5]*22)
        result=rotation(own,benchmark)
        self.assertAlmostEqual(result['periods']['1D']['relative'],.5)

    def test_cnn_observation(self):
        raw={'fear_and_greed':{'score':41.4,'rating':'fear','timestamp':'2026-10-07T15:00:00Z','previous_close':47.2}}
        with patch('refresh_briefing.urllib.request.urlopen',return_value=io.BytesIO(json.dumps(raw).encode())):
            result=sentiment()
        self.assertEqual(result['score'],41.4)
        self.assertEqual(result['previousClose'],47.2)
        self.assertEqual(result['source'],'CNN')

    def test_cnn_invalid_score_not_displayed(self):
        raw={'fear_and_greed':{'score':101,'timestamp':'2026-10-07T15:00:00Z'}}
        with patch('refresh_briefing.urllib.request.urlopen',return_value=io.BytesIO(json.dumps(raw).encode())):
            with self.assertRaises(ValueError):sentiment()

if __name__=='__main__':unittest.main()
