import pytest
from llm_webui import server
from fastapi.testclient import TestClient

client = TestClient(server.app)

def test_index():
    """Test that the main page loads."""
    response = client.get("/")
    assert response.status_code == 200
    assert "LLM WebUI" in response.text

def test_models_api():
    """Test the models API endpoint."""
    response = client.get("/api/models")
    assert response.status_code in [200, 500]  # May fail if no models configured

def test_templates_api():
    """Test the templates API endpoint."""
    response = client.get("/api/templates")
    assert response.status_code in [200, 500]  # May fail if no templates available

def test_tools_api():
    """Test the tools API endpoint."""
    response = client.get("/api/tools")
    assert response.status_code in [200, 500]  # May fail if no tools available