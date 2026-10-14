
import unittest

from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


class EcoSortAPITests(unittest.TestCase):

    def test_health_endpoint(self):
        response = client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["app"], "EcoSort AI")

    def test_api_status_endpoint(self):
        response = client.get("/api/status")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_plastic_bottle_disposal(self):
        response = client.get("/api/disposal/plastic_bottle")

        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["category"], "plastic_bottle")
        self.assertIn("instructions", data)
        self.assertTrue(len(data["instructions"]) > 0)

    def test_unknown_disposal_category(self):
        response = client.get("/api/disposal/not_a_real_category")

        self.assertEqual(response.status_code, 404)

    def test_rejects_unsupported_upload_type(self):
        response = client.post(
            "/api/classify",
            files={
                "file": (
                    "document.txt",
                    b"This is not an image.",
                    "text/plain",
                )
            },
        )

        self.assertEqual(response.status_code, 415)

    def test_rejects_empty_image_upload(self):
        response = client.post(
            "/api/classify",
            files={
                "file": (
                    "empty.png",
                    b"",
                    "image/png",
                )
            },
        )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
