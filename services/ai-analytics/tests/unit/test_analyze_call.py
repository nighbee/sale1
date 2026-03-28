import pytest
from unittest.mock import MagicMock, patch
import sys
import os

# Add service root to path
sys.path.append(os.path.join(os.getcwd(), "services/ai-analytics"))

# Mock the postgres_repo before importing AnalyzeCallUseCase
with patch.dict('sys.modules', {
    'src.adapters.storage.postgres_repo': MagicMock(),
    'src.adapters.llm.factory': MagicMock(),
    'src.adapters.events.redis_publisher': MagicMock(),
    'src.adapters.crm.amocrm_client': MagicMock(),
    'src.infrastructure.api.main_api_client': MagicMock(),
    'src.infrastructure.prompts.system_prompts': MagicMock(),
}):
    from src.core.usecases.analyze_call import AnalyzeCallUseCase

def test_validate_llm_response_success():
    use_case = AnalyzeCallUseCase()
    analysis = {
        "qualityOfCall": 80,
        "scriptMatch": 90,
        "errorsFree": 100,
        "recommendation": "Follow the script more closely next time.",
        "brief": "The agent handled the call well but missed some points.",
        "nextBestAction": "Schedule a follow-up call."
    }
    # Should not raise
    use_case._validate_llm_response(analysis, "test_call_id")

def test_validate_llm_response_short_next_best_action_passes():
    use_case = AnalyzeCallUseCase()
    analysis = {
        "qualityOfCall": 80,
        "scriptMatch": 90,
        "errorsFree": 100,
        "recommendation": "R",
        "brief": "B",
        "nextBestAction": "N" # Now passes (min 1)
    }
    # Should not raise now
    use_case._validate_llm_response(analysis, "test_call_id")
    assert analysis["nextBestAction"] == "N"

def test_validate_llm_response_converts_to_string():
    use_case = AnalyzeCallUseCase()
    analysis = {
        "qualityOfCall": 80,
        "scriptMatch": 90,
        "errorsFree": 100,
        "recommendation": "Rec",
        "brief": "Brief",
        "nextBestAction": 123 # Should be converted to "123"
    }
    use_case._validate_llm_response(analysis, "test_call_id")
    assert analysis["nextBestAction"] == "123"

def test_validate_llm_response_clamps_numeric():
    use_case = AnalyzeCallUseCase()
    analysis = {
        "qualityOfCall": 150, # Should be clamped to 100
        "scriptMatch": -10,  # Should be clamped to 0
        "errorsFree": 100,
        "recommendation": "Rec",
        "brief": "Brief",
        "nextBestAction": "Next"
    }
    use_case._validate_llm_response(analysis, "test_call_id")
    assert analysis["qualityOfCall"] == 100
    assert analysis["scriptMatch"] == 0

def test_validate_llm_response_converts_numeric_string():
    use_case = AnalyzeCallUseCase()
    analysis = {
        "qualityOfCall": "85", # Should be converted to float
        "scriptMatch": 90,
        "errorsFree": 100,
        "recommendation": "Rec",
        "brief": "Brief",
        "nextBestAction": "Next"
    }
    use_case._validate_llm_response(analysis, "test_call_id")
    assert analysis["qualityOfCall"] == 85.0
    assert isinstance(analysis["qualityOfCall"], float)
