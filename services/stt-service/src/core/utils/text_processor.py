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
    "мын", "мін", "сың", "сің",
    "жан", "хан", "гүл", "гул"
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
    # Only split 'болады' if it's at the end of another word and not separate
    result = re.sub(r'([А-ЯӘҚҒҮҰІӨҺа-яәқғүұіөһ]{3,})(болады)', r'\1 \2', result)

    return result.strip()

class SonioxTranscriptProcessor:
    """
    Professional processor for Soniox Speech-to-Text API output.
    Recombines token fragments, fixes Kazakh spacing, handles sequential diarization,
    and preserves timestamps.
    """
    @staticmethod
    def process(result: Any, language: Optional[str] = None) -> List[Dict[str, Any]]:
        tokens = getattr(result, "tokens", [])

        # Fallback if no tokens but we have full text
        if not tokens:
            text = getattr(result, "text", "")
            if text:
                cleaned_text = clean_kazakh_text(text) if language == "kk" else text
                return [{
                    "start": 0.0,
                    "end": 0.0,
                    "text": cleaned_text,
                    "speaker": "UNKNOWN"
                }]
            return []

        # Check if we have actual diarization info
        has_real_diarization = any(getattr(t, "speaker_id", None) is not None for t in tokens)

        segments = []
        speaker_map = {}
        next_speaker_idx = 1

        current_speaker_raw = None
        current_segment = None

        for token in tokens:
            text = getattr(token, "text", "")
            # Skip tokens without text
            if not text:
                continue

            speaker_id_raw = getattr(token, "speaker_id", None)

            if has_real_diarization:
                # Map raw speaker_id to sequential Speaker labels
                if speaker_id_raw not in speaker_map:
                    speaker_map[speaker_id_raw] = f"Speaker {next_speaker_idx}"
                    next_speaker_idx += 1
                speaker_label = speaker_map[speaker_id_raw]
            else:
                speaker_label = "UNKNOWN"

            # Soniox tokens have start_ms and end_ms
            start_ms = getattr(token, "start_ms", 0)
            end_ms = getattr(token, "end_ms", 0)

            is_new_speaker = speaker_id_raw != current_speaker_raw
            # Split if speaker changed or gap > 1.5s
            is_gap = current_segment and (start_ms - current_segment["end_ms"]) > 1500

            if current_segment is None or is_new_speaker or is_gap:
                if current_segment:
                    segments.append(SonioxTranscriptProcessor._finalize_segment(current_segment, language))

                current_speaker_raw = speaker_id_raw
                current_segment = {
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "text": text,
                    "speaker": speaker_label
                }
            else:
                current_segment["end_ms"] = end_ms
                current_segment["text"] += text

        if current_segment:
            segments.append(SonioxTranscriptProcessor._finalize_segment(current_segment, language))

        return segments

    @staticmethod
    def _finalize_segment(segment_data: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
        text = segment_data["text"]
        if language == "kk":
            text = clean_kazakh_text(text)
        else:
            # Fix spacing around punctuation for other languages
            text = re.sub(r'\s+([,.!?;:])', r'\1', text)
            text = re.sub(r'([,.!?;:])([^\s])', r'\1 \2', text)
            text = re.sub(r'\s+', ' ', text).strip()

        # Ensure first letter is capitalized
        if text:
            text = text.strip()
            if text and text[0].islower():
                text = text[0].upper() + text[1:]

            # Add a period if it doesn't end with punctuation
            if text and text[-1] not in ".,!?;:":
                text += "."

        return {
            "start": segment_data["start_ms"] / 1000.0,
            "end": segment_data["end_ms"] / 1000.0,
            "text": text,
            "speaker": segment_data["speaker"]
        }

def format_transcript(segments: List[Dict[str, Any]], language: Optional[str] = None) -> str:
    """
    Formats segments into a clean readable transcript with speaker labels.
    Format: [Speaker X]: <text>
    If language is 'kk', applies Kazakh text cleaning.
    If multiple consecutive segments have the same speaker, only show speaker label for the first one.
    If speaker is UNKNOWN, do not show label.
    """
    formatted_lines = []
    last_speaker = None

    # Check if we should even show speaker labels (only if we have known speakers)
    unique_speakers = set(seg.get("speaker", "UNKNOWN") for seg in segments)
    show_labels = any(s != "UNKNOWN" for s in unique_speakers)

    for seg in segments:
        speaker = seg.get("speaker", "UNKNOWN")

        # Standardize speaker label
        speaker_label = speaker
        if isinstance(speaker, str) and speaker.startswith("SPEAKER_"):
            try:
                idx_part = speaker.split("_")[1]
                if idx_part.isdigit():
                    speaker_label = f"Speaker {int(idx_part) + 1}"
                else:
                    speaker_label = f"Speaker {idx_part}"
            except:
                speaker_label = f"Speaker {speaker}"
        elif isinstance(speaker, str) and speaker.isdigit():
            speaker_label = f"Speaker {int(speaker) + 1}"

        text = seg.get("text", "").strip()
        if not text:
            continue

        # Already cleaned text if from SonioxTranscriptProcessor, otherwise clean
        cleaned_text = text
        if "Speaker" not in speaker_label and speaker_label != "UNKNOWN": # i.e. it came from raw segments not processed yet
            if language == "kk":
                cleaned_text = clean_kazakh_text(text)
            else:
                cleaned_text = re.sub(r'\s+([,.!?;:])', r'\1', text)
                cleaned_text = re.sub(r'([,.!?;:])([^\s])', r'\1 \2', cleaned_text)
                cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()

        # Determine if we should show the speaker label
        if show_labels and speaker_label != "UNKNOWN":
            if speaker_label != last_speaker:
                formatted_lines.append(f"[{speaker_label}]: {cleaned_text}")
                last_speaker = speaker_label
            else:
                # Just append text for the same speaker
                # If the last line is from the same speaker, we can try to append it or just new line
                # Let's use new line but without label for clarity
                formatted_lines.append(f"            {cleaned_text}")
        else:
            formatted_lines.append(cleaned_text)

    return "\n".join(formatted_lines)
