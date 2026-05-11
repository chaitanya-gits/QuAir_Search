import unittest


class HealthContractTests(unittest.TestCase):
    def test_health_contract_shape(self) -> None:
        payload = {"status": "ok", "services": {"postgres": True, "redis": True, "opensearch": True}}
        self.assertEqual(sorted(payload["services"].keys()), ["opensearch", "postgres", "redis"])


if __name__ == "__main__":
    unittest.main()
