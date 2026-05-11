import unittest

from backend.ranking.pagerank import compute_pagerank_scores


class PageRankTests(unittest.TestCase):
    def test_linked_page_gets_more_authority_than_source_only_page(self) -> None:
        scores = compute_pagerank_scores(
            [
                ("https://example.com/a", "https://example.com/b"),
                ("https://example.com/c", "https://example.com/b"),
            ],
            nodes=[
                "https://example.com/a",
                "https://example.com/b",
                "https://example.com/c",
            ],
        )

        self.assertGreater(
            scores["https://example.com/b"],
            scores["https://example.com/a"],
        )
        self.assertGreater(
            scores["https://example.com/b"],
            scores["https://example.com/c"],
        )

    def test_nodes_without_links_still_receive_base_score(self) -> None:
        scores = compute_pagerank_scores(
            [],
            nodes=["https://example.com/a", "https://example.com/b"],
        )

        self.assertEqual(set(scores), {"https://example.com/a", "https://example.com/b"})
        self.assertAlmostEqual(scores["https://example.com/a"], 1.0)
        self.assertAlmostEqual(scores["https://example.com/b"], 1.0)


if __name__ == "__main__":
    unittest.main()
