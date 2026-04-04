import pytest
from src.core.utils.text_processor import clean_kazakh_text, format_transcript, SonioxTranscriptProcessor
from unittest.mock import MagicMock

def test_kazakh_word_reconstruction_v2():
    # Example from user
    raw = "Ал ло , со л ма , А с бер г И на з ? Со л ма , тү сі н ді м. Е сі м А ру жан бо ла ды..."
    cleaned = clean_kazakh_text(raw)

    # Expected: "Алло, сол ма, Асберг Иназ? Сол ма, түсіндім. Есім Аружан болады..."
    # Current implementation might fail on "А с бер г И на з" -> "Асберг Иназ"
    assert "Алло" in cleaned
    assert "сол ма" in cleaned
    assert "Асберг Иназ" in cleaned
    assert "түсіндім" in cleaned
    assert "Аружан" in cleaned
    assert "болады" in cleaned

def test_format_transcript_with_timestamps():
    segments = [
        {"start": 5.0, "end": 7.0, "speaker": "Speaker 1", "text": "Алло, қалайсыз?"},
        {"start": 8.0, "end": 12.0, "speaker": "Speaker 2", "text": "Жақсы, рахмет."},
        {"start": 12.5, "end": 15.0, "speaker": "Speaker 2", "text": "Сізге Местана командасынан хабарласамын."},
        {"start": 16.0, "end": 17.5, "speaker": "Speaker 1", "text": "Иә, түсіндім."}
    ]

    # Test without timestamps
    formatted = format_transcript(segments)
    expected = (
        "[Speaker 1]: Алло, қалайсыз?\n"
        "[Speaker 2]: Жақсы, рахмет. Сізге Местана командасынан хабарласамын.\n"
        "[Speaker 1]: Иә, түсіндім."
    )
    assert formatted.strip() == expected.strip()

    # Test with timestamps
    formatted_ts = format_transcript(segments, include_timestamps=True)
    assert "[00:05] [Speaker 1]: Алло, қалайсыз?" in formatted_ts
    assert "[00:08] [Speaker 2]: Жақсы, рахмет. Сізге Местана командасынан хабарласамын." in formatted_ts
    assert "[00:16] [Speaker 1]: Иә, түсіндім." in formatted_ts

def test_speaker_grouping_logic():
    segments = [
        {"start": 0.0, "end": 2.0, "speaker": "Speaker 1", "text": "Sentence one."},
        {"start": 2.1, "end": 4.0, "speaker": "Speaker 1", "text": "Sentence two."},
        {"start": 5.0, "end": 7.0, "speaker": "Speaker 2", "text": "Sentence three."}
    ]

    formatted = format_transcript(segments)
    # Consecutive segments from same speaker should be merged into one block
    assert "[Speaker 1]: Sentence one. Sentence two." in formatted
    assert "[Speaker 2]: Sentence three." in formatted
