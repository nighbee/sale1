import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock
from src.infrastructure.llm.openai_client import OpenAIClient
import openai

@pytest.mark.asyncio
async def test_analyze_sends_json_mode_for_whitelisted_model():
    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai_class:
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock()

        # Mock response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"result": "ok"}'
        mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        mock_client.chat.completions.create.return_value = mock_response

        client = OpenAIClient(api_key="test", model="gpt-4o")
        await client.analyze("system", "user")

        # Verify response_format was sent
        args, kwargs = mock_client.chat.completions.create.call_args
        assert kwargs["response_format"] == {"type": "json_object"}

@pytest.mark.asyncio
async def test_analyze_does_not_send_json_mode_for_non_whitelisted_model():
    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai_class:
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock()

        # Mock response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"result": "ok"}'
        mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        mock_client.chat.completions.create.return_value = mock_response

        client = OpenAIClient(api_key="test", model="gpt-4")
        await client.analyze("system", "user")

        # Verify response_format was NOT sent
        args, kwargs = mock_client.chat.completions.create.call_args
        assert "response_format" not in kwargs

@pytest.mark.asyncio
async def test_analyze_fallback_on_json_mode_error():
    # This test verifies that if json_object fails even for a whitelisted model, it retries without it
    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai_class:
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock()

        # 1st call fails with BadRequestError
        error_message = "Invalid parameter: 'response_format' of type 'json_object' is not supported with this model."
        bad_request = openai.BadRequestError(
            message=error_message,
            response=MagicMock(status_code=400),
            body={'error': {'message': error_message, 'type': 'invalid_request_error', 'param': 'response_format', 'code': None}}
        )

        # 2nd call succeeds
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"result": "fallback_ok"}'
        mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)

        mock_client.chat.completions.create.side_effect = [bad_request, mock_response]

        # Use a model that IS whitelisted but we simulate it failing
        client = OpenAIClient(api_key="test", model="gpt-4o")
        result = await client.analyze("system", "user")

        assert result == {"result": "fallback_ok"}
        assert mock_client.chat.completions.create.call_count == 2

        # Verify 1st call had response_format
        _, kwargs1 = mock_client.chat.completions.create.call_args_list[0]
        assert kwargs1["response_format"] == {"type": "json_object"}

        # Verify 2nd call did NOT have response_format
        _, kwargs2 = mock_client.chat.completions.create.call_args_list[1]
        assert "response_format" not in kwargs2

@pytest.mark.asyncio
async def test_analyze_robust_json_extraction():
    # Verify that it can extract JSON even if wrapped in markdown
    with patch("src.infrastructure.llm.openai_client.AsyncOpenAI") as mock_openai_class:
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock()

        # Mock response with markdown
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = 'Here is the analysis:\n```json\n{"result": "markdown_ok"}\n```\nHope this helps!'
        mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        mock_client.chat.completions.create.return_value = mock_response

        client = OpenAIClient(api_key="test", model="gpt-4")
        result = await client.analyze("system", "user")

        assert result == {"result": "markdown_ok"}
