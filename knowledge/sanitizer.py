"""
Knowledge Sanitizer: Enforces strict data boundary around retrieved passages.
Treats all manuals, notes, and work orders as untrusted DATA.
Neutralizes jailbreaks, instruction injections, and wraps passages in safe delimiters.
"""
import re
from typing import Dict, Any, List


SUSPICIOUS_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|constraints|prompt)", re.IGNORECASE),
    re.compile(r"override\s+(supervisor|safety|governance|system)", re.IGNORECASE),
    re.compile(r"approve\s+(shutdown|work\s+order)\s+immediately", re.IGNORECASE),
    re.compile(r"safe\s+to\s+operate\s+without", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
]


def sanitize_text(raw_text: str) -> Dict[str, Any]:
    """
    Scans text for instruction injection patterns.
    Neutralizes commands by defanging tokens and tagging with warning metadata.
    """
    flagged_attacks = []
    sanitized = raw_text

    for pattern in SUSPICIOUS_PATTERNS:
        matches = pattern.findall(raw_text)
        if matches:
            flagged_attacks.append(pattern.pattern)
            # Defang pattern
            sanitized = pattern.sub(r"[NEUTRALIZED_UNTRUSTED_INSTRUCTION]", sanitized)

    # Escape delimiter tags to prevent tag escape attacks
    sanitized = sanitized.replace("<untrusted_data", "&lt;untrusted_data")
    sanitized = sanitized.replace("</untrusted_data>", "&lt;/untrusted_data&gt;")

    return {
        "text": sanitized,
        "is_suspicious": len(flagged_attacks) > 0,
        "flagged_patterns": flagged_attacks,
    }


def wrap_passage_in_delimiters(passage_id: str, source: str, asset_type: str, content: str) -> str:
    """
    Wraps sanitized text in an explicit untrusted data boundary.
    The LLM system prompt instructs that text within these tags contains FACTS/HISTORY only,
    never executable commands or policy updates.
    """
    san_res = sanitize_text(content)
    clean_content = san_res["text"]
    flag_attr = ' security_warning="INJECTION_ATTEMPT_DETECTED"' if san_res["is_suspicious"] else ""
    
    return (
        f'<untrusted_reference_data id="{passage_id}" source="{source}" asset_type="{asset_type}"{flag_attr}>\n'
        f"{clean_content}\n"
        f"</untrusted_reference_data>"
    )
