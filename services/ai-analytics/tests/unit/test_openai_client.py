import os
import pytest
from unittest.mock import patch, MagicMock
from src.infrastructure.llm.openai_client import OpenAIClient

@pytest.fixture
def clean_env():
    # Remove relevant env vars to ensure tests are isolated
    vars_to_remove = ["LLM_API_KEY", "OPENAI_API_KEY", "LLM_BASE_URL", "LLM_MODEL"]
    original_env = {v: os.environ.get(v) for v in vars_to_remove}
    for v in vars_to_remove:
        if v in os.environ:
            del os.environ[v]
    yield
    # Restore original env
    for v, val in original_env.items():
        if val is not None:
            os.environ[v] = val
        elif v in os.environ:
            del os.environ[v]

def test_openai_client_explicit_params(clean_env):
    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai:
        client = OpenAIClient(api_key="test_key", base_url="http://test_url", model="test_model")

        assert client.api_key == "test_key"
        assert client.base_url == "http://test_url"
        assert client.default_model == "test_model"

        mock_openai.assert_called_with(api_key="test_key", base_url="http://test_url")

def test_openai_client_env_fallback(clean_env):
    os.environ["LLM_API_KEY"] = "env_llm_key"
    os.environ["LLM_BASE_URL"] = "http://env_url"
    os.environ["LLM_MODEL"] = "env_model"

    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai:
        client = OpenAIClient()

        assert client.api_key == "env_llm_key"
        assert client.base_url == "http://env_url"
        assert client.default_model == "env_model"

        mock_openai.assert_called_with(api_key="env_llm_key", base_url="http://env_url")

def test_openai_client_openai_key_fallback(clean_env):
    os.environ["OPENAI_API_KEY"] = "openai_key"

    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai:
        client = OpenAIClient()

        assert client.api_key == "openai_key"
        assert client.base_url is None
        mock_openai.assert_called_with(api_key="openai_key")

def test_openai_client_priority(clean_env):
    os.environ["LLM_API_KEY"] = "env_llm_key"
    os.environ["OPENAI_API_KEY"] = "openai_key"

    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai:
        # Explicit key should win
        client = OpenAIClient(api_key="explicit_key")
        assert client.api_key == "explicit_key"

        # LLM_API_KEY should win over OPENAI_API_KEY
        client2 = OpenAIClient()
        assert client2.api_key == "env_llm_key"

def test_openai_client_no_blackbox_key(clean_env):
    os.environ["BLACKBOX_API_KEY"] = "blackbox_key"

    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai:
        client = OpenAIClient()
        # Should not pick up BLACKBOX_API_KEY anymore
        assert client.api_key is None
