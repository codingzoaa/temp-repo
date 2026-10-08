import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh_heatmap import parse_members,symbol_key
class MembershipTests(unittest.TestCase):
 def test_symbol_share_classes(self):
  self.assertEqual(symbol_key('BRK.B'),symbol_key('BRK/B'))
  self.assertEqual(symbol_key('BRK.B'),symbol_key('BRK-B'))
 def test_validation(self):
  self.assertRaises(ValueError,parse_members,'Symbol,GICS Sector\nNVDA,Technology\n')
  valid='Symbol,GICS Sector\n'+''.join(f'S{i},Information Technology\n' for i in range(503))
  self.assertEqual(len(parse_members(valid)),503)
  self.assertRaises(ValueError,parse_members,valid.replace('S1,','S0,'))
  self.assertRaises(ValueError,parse_members,valid.replace('S1,Information Technology','S1,'))

class HeatmapReturnTests(unittest.TestCase):
 def test_trading_day_offsets_and_adjusted_prices(self):
  from refresh_heatmap import period_returns
  history=[{'date':f'day-{i}','close':1000,'adjusted':100+i} for i in range(22)]
  p=period_returns(history)
  self.assertAlmostEqual(p['1D']['return'],(121/120-1)*100)
  self.assertAlmostEqual(p['1W']['return'],(121/116-1)*100)
  self.assertAlmostEqual(p['1M']['return'],21)
  self.assertEqual(p['1M']['startDate'],'day-0')
 def test_insufficient_history_remains_missing(self):
  from refresh_heatmap import period_returns
  p=period_returns([{'date':'today','close':10}])
  self.assertTrue(all(item['return'] is None for item in p.values()))
