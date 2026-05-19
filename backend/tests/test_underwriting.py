import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_underwriting_unauthorized():
    response = client.post("/api/v1/underwriting/evaluate", json={"text": "test"})
    assert response.status_code == 401

def test_underwriting_authorized():
    response = client.post(
        "/api/v1/underwriting/evaluate",
        json={"text": "test", "user_id": "123"},
        headers={"Authorization": "Bearer test_token_123"}
    )
    assert response.status_code == 200
    data = response.json()
    # Updated to match the refined verification return
    assert data["user_id"] == "clerk_user_id_verified"
    assert data["level"] == "low"
