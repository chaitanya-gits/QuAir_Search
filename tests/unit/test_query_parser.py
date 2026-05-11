import unittest

from backend.search.query_parser import parse_query


class QueryParserTests(unittest.TestCase):
    def test_query_parser_removes_stopwords(self) -> None:
        parsed = parse_query("search the best python docs")
        self.assertEqual(parsed.tokens, ["best", "python", "docs"])


if __name__ == "__main__":
    unittest.main()
