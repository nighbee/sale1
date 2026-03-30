import json
from typing import List, Dict

def load_cookies(filepath: str) -> List[Dict[str, str]]:
    """
    Loads cookies from a JSON file and formats them for Playwright's add_cookies().

    Expected JSON format:
    [
        {"name": "...", "value": "...", "domain": "...", "path": "/"},
        ...
    ]
    """
    try:
        with open(filepath, 'r') as f:
            cookies = json.load(f)

        if not isinstance(cookies, list):
            raise ValueError("Cookies JSON must be a list of cookie objects.")

        # Basic validation of required fields for Playwright
        for cookie in cookies:
            if not all(k in cookie for k in ("name", "value", "domain")):
                raise ValueError(f"Cookie {cookie} is missing required fields (name, value, domain).")

        return cookies
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Failed to load cookies from {filepath}: {e}")
