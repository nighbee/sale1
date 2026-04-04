import pytest
from src.core.utils.text_processor import clean_kazakh_text, format_transcript, SonioxTranscriptProcessor
from unittest.mock import MagicMock

def test_kazakh_word_reconstruction():
    # Test "Ал ло" -> "Алло"
    assert clean_kazakh_text("Ал ло") == "Алло"

    # Test "коман дасы" -> "командасы"
    assert clean_kazakh_text("коман дасы") == "командасы"

    # Test "со л ма" -> "сол ма" (particle should stay separate if word is long enough,
    # but here 'со л' -> 'сол' and 'ма' is particle)
    # Actually 'со л' -> 'сол'. 'ма' is in KAZAKH_PARTICLES.
    # Logic: next is 'ма' (len 2, lowercase, in PARTICLES).
    # It won't merge unless clean_curr <= 4. 'сол' is 3 chars.
    # So it MIGHT merge if we are not careful.
    # Wait, my logic says:
    # if clean_next.lower() in KAZAKH_SUFFIXES and next_word[0].islower():
    #    if clean_next.lower() not in KAZAKH_PARTICLES or len(clean_curr) <= 4:
    #        should_merge = True
    # 'ма' is in SUFFIXES and PARTICLES. len('сол') is 3. So it WILL merge.
    # Maybe 4 is too much for particles?
    # But usually 'ма' is a question particle and should be separate.
    # If the user says "со л ма" -> "сол ма" is expected (from prompt: "Со л ма , тү сі н ді м" -> "сол ма, түсіндім")
    # Actually "сол ма" means "that one?". "солма" means "don't fade".
    # STT usually outputs "со л ма" for "сол ма".

    assert clean_kazakh_text("со л ма") == "сол ма"

def test_kazakh_single_letter_joining():
    # Test "к о м а н д а" -> "команда"
    assert clean_kazakh_text("к о м а н д а") == "команда"
    assert clean_kazakh_text("С ә л е м , х а л ы қ а р а л ы қ") == "Сәлем, халықаралық"

def test_speaker_label_formatting():
    segments = [
        {"speaker": "SPEAKER_0", "text": "Hello"},
        {"speaker": "1", "text": "Hi"},
        {"speaker": "Speaker 2", "text": "How are you?"},
        {"speaker": "UNKNOWN", "text": "Someone is talking"}
    ]
    formatted = format_transcript(segments)

    assert "[Speaker 1]: Hello" in formatted
    assert "[Speaker 2]: Hi" in formatted # "1" -> "Speaker 2" (idx 1+1? No, if it's "1" as string)
    # Wait, if speaker is "1", speaker_label = f"Speaker {speaker}" -> "Speaker 1"?
    # Let's check my code:
    # elif speaker != "UNKNOWN":
    #    speaker_label = f"Speaker {speaker}" if not speaker.startswith("Speaker ") else speaker
    # So "1" -> "Speaker 1". "Speaker 2" -> "Speaker 2".

    assert "[Speaker 1]: Hello" in formatted
    assert "[Speaker 2]: Hi How are you?" in formatted

    # Actually my previous format_transcript test said:
    # SPEAKER_0 -> Speaker 1
    # SPEAKER_1 -> Speaker 2

    segments2 = [{"speaker": "SPEAKER_0", "text": "Test"}]
    assert "[Speaker 1]: Test" in format_transcript(segments2)

def test_full_soniox_example():
    raw = "Ал ло , со л ма , А с бер г И на з ? Со л ма , тү сі н ді м. Е сі м А ру жан бо ла ды..."
    cleaned = clean_kazakh_text(raw)

    # Expected: "Алло, сол ма, Асберг Иназ? Сол ма, түсіндім. Есім Аружан болады..."
    assert "Алло" in cleaned
    assert "сол ма" in cleaned
    assert "Асберг Иназ" in cleaned
    assert "түсіндім" in cleaned
    assert "Есім Аружан" in cleaned
    assert "..." in cleaned

def test_suffix_merging():
    # "бала лар" -> "балалар"
    assert clean_kazakh_text("бала лар") == "балалар"
    # "мектеп ке" -> "мектепке"
    assert clean_kazakh_text("мектеп ке") == "мектепке"
    # "бара мын" -> "барамын"
    assert clean_kazakh_text("бара мын") == "барамын"

def test_soniox_transcript_processor_professional():
    # Mock Soniox JSON output
    # {
    #   "tokens": [
    #     {"text":"А","speaker":1},
    #     {"text":"л","speaker":1},
    #     {"text":"л","speaker":1},
    #     {"text":"о","speaker":1},
    #     {"text":", ","speaker":1},
    #     {"text":"С","speaker":2},
    #     {"text":"ә","speaker":2},
    #     {"text":"л","speaker":2},
    #     {"text":"е","speaker":2},
    #     {"text":"м","speaker":2},
    #     {"text":"е","speaker":2},
    #     {"text":"т","speaker":2},
    #     {"text":"с","speaker":2},
    #     {"text":"і","speaker":2},
    #     {"text":"з","speaker":2},
    #     {"text":" ","speaker":2},
    #     {"text":"б","speaker":2},
    #     {"text":"е","speaker":2},
    #     {"text":"?","speaker":2}
    #   ]
    # }

    mock_result = MagicMock()

    tokens = []
    # Speaker 1: "А л л о , "
    for char in "Алло, ":
        token = MagicMock()
        token.text = char
        token.speaker_id = 1
        token.start_ms = 0
        token.end_ms = 100
        tokens.append(token)

    # Speaker 2: "С ә л е м е т с і з   б е ?"
    for char in "Сәлеметсіз бе?":
        token = MagicMock()
        token.text = char
        token.speaker_id = 2
        token.start_ms = 2000 # Gap of 1.9s
        token.end_ms = 2100
        tokens.append(token)

    mock_result.tokens = tokens

    segments = SonioxTranscriptProcessor.process(mock_result, language="kk")

    assert len(segments) == 2
    assert segments[0]["speaker"] == "Speaker 1"
    assert segments[0]["text"] == "Алло,"

    assert segments[1]["speaker"] == "Speaker 2"
    assert segments[1]["text"] == "Сәлеметсіз бе?"

    formatted = format_transcript(segments, language="kk")
    assert "[Speaker 1]: Алло," in formatted
    assert "[Speaker 2]: Сәлеметсіз бе?" in formatted

def test_soniox_sequential_numbering():
    mock_result = MagicMock()

    t1 = MagicMock()
    t1.text = "Hello"
    t1.speaker_id = 105 # High ID
    t1.start_ms = 0
    t1.end_ms = 500

    t2 = MagicMock()
    t2.text = "Hi"
    t2.speaker_id = 42 # Different ID
    t2.start_ms = 1000
    t2.end_ms = 1500

    mock_result.tokens = [t1, t2]

    segments = SonioxTranscriptProcessor.process(mock_result)

    assert segments[0]["speaker"] == "Speaker 1" # 105 -> Speaker 1
    assert segments[1]["speaker"] == "Speaker 2" # 42 -> Speaker 2

def test_soniox_gap_splitting():
    mock_result = MagicMock()

    t1 = MagicMock()
    t1.text = "Part one."
    t1.speaker_id = 1
    t1.start_ms = 0
    t1.end_ms = 1000

    t2 = MagicMock()
    t2.text = "Part two."
    t2.speaker_id = 1
    t2.start_ms = 3000 # 2s gap
    t2.end_ms = 4000

    mock_result.tokens = [t1, t2]

    segments = SonioxTranscriptProcessor.process(mock_result)

    assert len(segments) == 2
    assert segments[0]["text"] == "Part one."
    assert segments[1]["text"] == "Part two."

    formatted = format_transcript(segments)
    assert "[Speaker 1]: Part one." in formatted
    assert "\n\n[Speaker 1]: Part two." in formatted

def test_soniox_no_diarization_fallback():
    mock_result = MagicMock()

    t1 = MagicMock()
    t1.text = "Hello world."
    t1.speaker_id = None # No diarization
    t1.start_ms = 0
    t1.end_ms = 1000

    mock_result.tokens = [t1]

    segments = SonioxTranscriptProcessor.process(mock_result)

    assert len(segments) == 1
    assert segments[0]["speaker"] == "UNKNOWN"

    formatted = format_transcript(segments)
    assert formatted == "Hello world." # No labels

def test_kazakh_filler_removal():
    assert clean_kazakh_text("аа мм жаңадан қосылдыңыз") == "жаңадан қосылдыңыз"
    assert clean_kazakh_text("жаңадан мм қосылдыңыз") == "жаңадан қосылдыңыз"

def test_no_diarization_single_paragraph_kazakh():
    segments = [
        {"speaker": "UNKNOWN", "text": "жа ң а дан"},
        {"speaker": "UNKNOWN", "text": "қо сыл дың ыз"}
    ]
    # format_transcript applies clean_kazakh_text to the whole thing if UNKNOWN
    formatted = format_transcript(segments, language="kk")
    assert formatted == "жаңадан қосылдыңыз"
