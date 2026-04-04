import pytest
from src.core.utils.text_processor import clean_kazakh_text, format_transcript

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
    assert "[Speaker 2]: Hi" in formatted
    assert "[Speaker 2]: How are you?" in formatted

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
