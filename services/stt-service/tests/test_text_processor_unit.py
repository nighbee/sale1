import pytest
from src.core.utils.text_processor import clean_kazakh_text, format_transcript

def test_clean_kazakh_text():
    # Example from user
    raw = "Ал ло , со л ма , А с бер г И на з ? Со л ма , тү сі н ді м. Е сі м А ру жан бо ла ды..."

    cleaned = clean_kazakh_text(raw)
    assert "Алло" in cleaned
    assert "түсіндім" in cleaned
    assert "Есім" in cleaned
    assert "?" in cleaned
    assert "..." in cleaned

def test_format_transcript_kazakh():
    segments = [
        {"speaker": "SPEAKER_0", "text": "Ал ло"},
        {"speaker": "SPEAKER_1", "text": "со л ма"}
    ]
    # Should clean when language is 'kk'
    formatted = format_transcript(segments, language="kk")
    assert "[Speaker 1]: Алло" in formatted
    # "со л ма" -> "солма" because 'ма' is lowercase and 2 letters, and not in KAZAKH_PARTICLES if we don't have space?
    # Wait, 'ма' IS in KAZAKH_PARTICLES. So "со л ма" should stay "сол ма".
    assert "[Speaker 2]: сол ма" in formatted

    assert segments[0]["text"] == "Алло"
    assert segments[0]["speaker"] == "Speaker 1"

def test_format_transcript_english_no_regression():
    segments = [
        {"speaker": "SPEAKER_0", "text": "A big dog ."},
        {"speaker": "SPEAKER_1", "text": "I am here ."}
    ]
    # Should NOT merge when language is 'en'
    formatted = format_transcript(segments, language="en")
    assert "[Speaker 1]: A big dog." in formatted
    assert "[Speaker 2]: I am here." in formatted

    assert segments[0]["text"] == "A big dog."
    assert segments[1]["text"] == "I am here."

def test_punctuation_spacing():
    # Punctuation cleaning should still work for all languages
    raw = "Привет , как дела ? Хорошо ."
    # format_transcript(..., language='ru') will apply it
    segments = [{"speaker": "SPEAKER_0", "text": "Привет , как дела ? Хорошо ."}]
    formatted = format_transcript(segments, language="ru")
    assert "Привет, как дела? Хорошо." in formatted
