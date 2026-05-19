import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_underwriting_unauthorized():
    response = client.post("/api/v1/underwriting/evaluate", json={"text": "test"})
    assert response.status_code == 401

def test_underwriting_authorized():
    # Token must be at least 20 chars now
    token = "test_token_v1_initialization_flow"
    response = client.post(
        "/api/v1/underwriting/evaluate",
        json={"text": "test", "user_id": "123"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == f"clerk_user_{token[:12]}"
    assert data["level"] == "low"
