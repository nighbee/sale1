import re
from typing import List, Dict, Any, Optional

# Common short Kazakh particles that should remain separate
KAZAKH_PARTICLES = {"ма", "ме", "ба", "бе", "па", "пе", "да", "де", "та", "те"}
# Particles that are strictly separate
STRICT_PARTICLES = {"ма", "ме", "ба", "бе", "па", "пе"}

# Common suffixes that are often incorrectly split by STT
# Note: some are also particles (да, де, та, те).
# Suffixes are attached to words, particles are separate.
KAZAKH_SUFFIXES = {
    "лар", "лер", "дар", "дер", "тар", "тер",
    "ның", "нің", "дың", "дің", "тың", "тің",
    "ға", "ге", "қа", "ке",
    "ны", "ні", "ды", "ді", "ты", "ті",
    "дан", "ден", "тан", "тен",
    "мен", "бен", "пен",
    "сы", "сі", "ы", "і",
    "мыз", "міз", "сыз", "сіз",
    "дасы", "десі", "ласы", "лесі",
    "мын", "мін", "сың", "сің"
}

def clean_kazakh_text(text: str) -> str:
    """
    Cleans Kazakh transcription text by merging split words/syllables and
    fixing punctuation spacing.
    """
    if not text:
        return ""

    # 1. Remove extra spaces before punctuation
    text = re.sub(r'\s+([,.!?;:])', r'\1', text)

    # 2. Fix single letter spacing: "к о м а н д а" -> "команда"
    # Only if it forms a word (3+ letters) or is clearly subword fragments
    def join_single_letters(match):
        joined = match.group(0).replace(" ", "")
        return joined

    # Match sequences of 2+ single letters
    # Strategy: merge all, THEN split if there's a STRICT particle at the end
    def merge_single_letters(m):
        tokens = m.group(0).split()
        joined = "".join(tokens)
        # Check for STRICT particles at the end
        for p in STRICT_PARTICLES:
            if joined.lower().endswith(p) and len(joined) > len(p):
                return joined[:-len(p)] + " " + joined[-len(p):]
        return joined

    # Repeat to ensure long chains are fully merged
    for _ in range(3):
        text = re.sub(r'\b[а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]\b(?:\s+\b[а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]\b)+',
                      merge_single_letters,
                      text)

    words = text.split()
    if not words:
        return ""

    merged = []
    current = words[0]


    for next_word in words[1:]:
        # If next_word is a punctuation mark, always merge it with current
        if re.match(r'^[,.!?;:]+$', next_word):
            current += next_word
            continue

        # Strip punctuation for length/content checks
        clean_curr = re.sub(r'[^a-zA-Zа-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]', '', current)
        clean_next = re.sub(r'[^a-zA-Zа-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]', '', next_word)

        should_merge = False

        # 1. Merge if it's a known suffix and it's lowercase
        if clean_next.lower() in KAZAKH_SUFFIXES and next_word[0].islower():
            # Special case for particles: "ма", "ме", etc. usually stay separate if they follow a word.
            if clean_next.lower() in KAZAKH_PARTICLES:
                if len(clean_curr) <= 2: # Only merge particles with very short fragments (syllables)
                    should_merge = True
            else:
                should_merge = True

        # 2. If next is very short (1-2 chars)
        if not should_merge and len(clean_next) > 0 and len(clean_next) <= 2:
            # If it's a single letter, almost always merge
            if len(clean_next) == 1:
                should_merge = True
            # If it's 2 letters, merge if it's lowercase AND not a common particle
            elif clean_next[0].islower() and clean_next.lower() not in KAZAKH_PARTICLES:
                should_merge = True

        # 3. Also merge if current is very short (1-2 chars)
        if not should_merge and len(clean_curr) > 0 and len(clean_curr) <= 2:
            # Don't merge if it's an uppercase single letter (initial) and next is a proper word
            if not (len(clean_curr) == 1 and current[0].isupper() and len(clean_next) > 3):
                should_merge = True

        if should_merge:
            # Check for sentence boundaries
            if re.search(r'[?!.]', current):
                merged.append(current)
                current = next_word
            else:
                current += next_word
        else:
            merged.append(current)
            current = next_word
    merged.append(current)

    result = " ".join(merged)
    # Fix spacing around punctuation
    result = re.sub(r'\s+([,.!?;:])', r'\1', result)
    result = re.sub(r'([,.!?;:])([^\s])', r'\1 \2', result)
    # Restore ellipsis
    result = re.sub(r'\.\s*\.\s*\.', '...', result)
    # Clean up double spaces
    result = re.sub(r'\s+', ' ', result)

    # Split merged words with capital letters inside (e.g. "АсбергИназ" -> "Асберг Иназ")
    # Also handle "ЕсімАружан" -> "Есім Аружан"
    # and "АсбергИназ" -> "Асберг Иназ"
    if len(result) > 5:
        # Match a character followed by an uppercase letter
        # Handle cases with optional spaces that STT might have put there
        # For Kazakh, we must be careful with specific letters
        result = re.sub(r'([а-яәқғүұіөһ])\s*([А-ЯӘҚҒҮҰІӨҺ])', r'\1 \2', result)
        # Smashed words with lowercase letters
        result = re.sub(r'([А-ЯӘҚҒҮҰІӨҺа-яәқғүұіөһ]{2,})(Аружан|Иназ)', r'\1 \2', result)

        # Merge fragments like "Есі м" -> "Есім"
        result = re.sub(r'\b([А-ЯӘҚҒҮҰІӨҺа-яәқғүұіөһ]+)\s+([а-яәқғүұіөһ])\b',
                        lambda m: m.group(1)+m.group(2) if m.group(2).lower() not in KAZAKH_PARTICLES else m.group(0),
                        result)

        # Handle smashed words with spaces: "А с берг" -> "Асберг"
        # Only merge if it's NOT a particle
        result = re.sub(r'\b([а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]{1,3})\s+([а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]{2,})\b',
                        lambda m: m.group(1)+m.group(2) if m.group(1).lower() not in KAZAKH_PARTICLES and m.group(2).lower() not in KAZAKH_PARTICLES else m.group(0),
                        result)
        # And vice versa: fragment followed by 1-3 chars
        result = re.sub(r'\b([а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]{2,})\s+([а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]{1,3})\b',
                        lambda m: m.group(1)+m.group(2) if m.group(2).lower() not in KAZAKH_PARTICLES and m.group(1).lower() not in KAZAKH_PARTICLES else m.group(0),
                        result)

    # 3. Final cleanup of common smashed words from Soniox
    result = re.sub(r'([А-ЯӘҚҒҮҰІӨҺа-яәқғүұіөһ]+)\s*(жан|болады)', r'\1 \2', result)

    return result.strip()

def format_transcript(segments: List[Dict[str, Any]], language: Optional[str] = None) -> str:
    """
    Formats segments into a clean readable transcript with speaker labels.
    Format: [Speaker X]: <text>
    If language is 'kk', applies Kazakh text cleaning.
    """
    formatted_lines = []
    for seg in segments:
        speaker = seg.get("speaker", "UNKNOWN")
        speaker_label = "Unknown"

        if isinstance(speaker, str):
            if speaker.startswith("SPEAKER_"):
                try:
                    idx_part = speaker.split("_")[1]
                    if idx_part.isdigit():
                        speaker_label = f"Speaker {int(idx_part) + 1}"
                    else:
                        speaker_label = f"Speaker {idx_part}"
                except:
                    speaker_label = f"Speaker {speaker}"
            elif speaker != "UNKNOWN":
                # If it's a numeric ID like "0", "1", increment it
                if speaker.isdigit():
                    speaker_label = f"Speaker {int(speaker) + 1}"
                else:
                    speaker_label = f"Speaker {speaker}" if not speaker.startswith("Speaker ") else speaker

        text = seg.get("text", "").strip()
        if text:
            # Only clean if it's explicitly Kazakh
            if language == "kk":
                cleaned_text = clean_kazakh_text(text)
            else:
                # Still fix punctuation for all languages
                cleaned_text = re.sub(r'\s+([,.!?;:])', r'\1', text)
                cleaned_text = re.sub(r'([,.!?;:])([^\s])', r'\1 \2', cleaned_text)
                cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()

            formatted_lines.append(f"[{speaker_label}]: {cleaned_text}")
            seg["text"] = cleaned_text
            seg["speaker"] = speaker_label

    return "\n".join(formatted_lines)
