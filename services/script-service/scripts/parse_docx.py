#!/usr/bin/env python3
import sys
from docx import Document

def extract_text(file_path):
    try:
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs if para.text])
        return text
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: parse_docx.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    print(extract_text(file_path))
