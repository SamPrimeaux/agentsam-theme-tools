import importlib.util
from pathlib import Path
import unittest

p=Path(__file__).resolve().parents[1]/"scripts"/"recover-pasted-html.py"
spec=importlib.util.spec_from_file_location("recover_html",p)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RecoveryTest(unittest.TestCase):
    def test_roundtrip(self):
        source=r"\<!DOCTYPE html>\n\<html>\<body>&#x20;Hello\</body>\</html>"
        # Test actual newlines and escaped punctuation, without executing HTML scripts.
        out=module.recover(source.replace(r"\n","\n"))
        self.assertIn("<!DOCTYPE html>",out)
        self.assertIn("<body>",out)
        self.assertIn(" Hello",out)
    def test_incomplete_fails(self):
        with self.assertRaises(ValueError):
            module.recover("<div>not a full document</div>")

if __name__=="__main__":
    unittest.main()
