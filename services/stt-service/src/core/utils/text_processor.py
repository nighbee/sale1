import re
from typing import List, Dict, Any, Optional

def clean_kazakh_text(text: str) -> str:
    """
    Cleans Kazakh transcription text by merging split words/syllables and
    fixing punctuation spacing.
    """
    if not text:
        return ""

    # 1. Remove extra spaces before punctuation
    text = re.sub(r'\s+([,.!?;:])', r'\1', text)

    words = text.split()
    if not words:
        return ""

    merged = []
    current = words[0]

    # Common short Kazakh particles that should remain separate
    KAZAKH_PARTICLES = {"ма", "ме", "ба", "бе", "па", "пе", "да", "де", "та", "те"}

    for next_word in words[1:]:
        # If next_word is a punctuation mark, always merge it with current
        if re.match(r'^[,.!?;:]+$', next_word):
            current += next_word
            continue

        # Strip punctuation for length/content checks
        clean_curr = re.sub(r'[^a-zA-Zа-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]', '', current)
        clean_next = re.sub(r'[^a-zA-Zа-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]', '', next_word)

        should_merge = False

        # If next is very short (1-2 chars)
        if len(clean_next) > 0 and len(clean_next) <= 2:
            # If it's a single letter, almost always merge
            if len(clean_next) == 1:
                should_merge = True
            # If it's 2 letters, merge if it's lowercase AND not a common particle
            elif clean_next[0].islower() and clean_next.lower() not in KAZAKH_PARTICLES:
                should_merge = True

        # Also merge if current is very short (1-2 chars)
        elif len(clean_curr) > 0 and len(clean_curr) <= 2:
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
    # Only for longer words to avoid breaking iPhone/eBay
    if len(result) > 10:
        result = re.sub(r'([а-яА-ЯӘҚҒҮҰІӨҺәқғүұіөһ]{3,})([A-ZА-ЯӘҚҒҮҰІӨҺ][а-яәқғүұіөһ]{3,})', r'\1 \2', result)

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
                        speaker_label = idx_part
                except:
                    speaker_label = speaker
            elif speaker != "UNKNOWN":
                speaker_label = speaker

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
