import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from jose import jwt

client = TestClient(app)

def create_mock_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, "secret", algorithm="HS256")

def test_underwriting_unauthorized():
    response = client.post("/api/v1/underwriting/evaluate", json={"text": "test"})
    assert response.status_code == 401

def test_underwriting_authorized():
    user_id = "clerk_12345"
    token = create_mock_token(user_id)
    response = client.post(
        "/api/v1/underwriting/evaluate",
        json={"text": "test", "user_id": user_id},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == user_id
    assert data["level"] == "low"
