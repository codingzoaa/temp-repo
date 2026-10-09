import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import refresh_editorial

class EditorialTests(unittest.TestCase):
    def test_missing_key_does_not_contact_provider_or_claim_ai(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data').mkdir()
            with patch.object(refresh_editorial,'ROOT',root),patch.dict(os.environ,{},clear=True),patch('urllib.request.urlopen') as call:
                refresh_editorial.generate()
                call.assert_not_called()
            self.assertFalse(json.loads((root/'data/editorial.json').read_text())['available'])

    def test_provider_failure_removes_previous_editorial_without_exposing_secret(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data').mkdir()
            for name in ['market','news','briefing']:(root/'data'/f'{name}.json').write_text('{}')
            (root/'data/editorial.json').write_text('{"available":true}')
            with patch.object(refresh_editorial,'ROOT',root),patch.dict(os.environ,{'OPENAI_API_KEY':'secret-test'},clear=True),patch('urllib.request.urlopen',side_effect=ValueError('secret-test')):
                refresh_editorial.generate()
            text=(root/'data/editorial.json').read_text()
            self.assertNotIn('secret-test',text)
            self.assertFalse(json.loads(text)['available'])
