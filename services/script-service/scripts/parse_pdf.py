#!/usr/bin/env python3
import sys
from PyPDF2 import PdfReader

def extract_text(file_path):
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: parse_pdf.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    print(extract_text(file_path))
