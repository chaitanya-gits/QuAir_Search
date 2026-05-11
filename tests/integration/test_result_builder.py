import unittest

from backend.search.result_builder import build_answer


class ResultBuilderTests(unittest.TestCase):
    def test_build_answer_uses_top_summaries(self) -> None:
        answer = build_answer(
            [
                {"summary": "First summary."},
                {"summary": "Second summary."},
            ]
        )
        self.assertIn("First summary.", answer)


if __name__ == "__main__":
    unittest.main()
