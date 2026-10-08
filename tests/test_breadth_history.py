import unittest,sys,datetime as dt
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from breadth_history import build_history

def stock(count,up=True):
 return {'history':[{'date':(dt.date(2025,1,1)+dt.timedelta(days=i)).isoformat(),'close':100+i if up else 1000-i,'adjusted':100+i if up else 1000-i} for i in range(count)]}
class BreadthHistoryTests(unittest.TestCase):
 def test_rising_and_falling_samples(self):
  rows=build_history([stock(400),stock(400,False)])
  self.assertEqual(len(rows),63)
  for p in rows:
   self.assertEqual((p['advancers'],p['decliners']),(1,1))
   self.assertEqual(p['above200'],50)
   self.assertEqual((p['newHighs'],p['newLows']),(1,1))
   self.assertEqual(p['highEligible'],2)
 def test_short_history_is_missing_not_zero(self):
  row=build_history([stock(10)])[-1]
  self.assertIsNone(row['above20']);self.assertIsNone(row['newHighs'])
  self.assertEqual(row['eligible20'],0)
 def test_variable_coverage(self):
  row=build_history([stock(400),stock(100,False)])[-1]
  self.assertEqual(row['eligible200'],1)
  self.assertEqual(row['above200'],100)
  self.assertEqual(row['measured'],1)
 def test_empty(self):self.assertEqual(build_history([]),[])
