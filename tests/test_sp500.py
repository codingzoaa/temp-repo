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
