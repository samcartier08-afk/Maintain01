"""
YAML/JSON Asset Profile Loader and Validator with robust pure-Python YAML parser.
"""
import os
import re
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from core.schemas import AssetProfile, SensorSpec, FailureMode, CriticalityClass


def parse_simple_yaml(text: str) -> Dict[str, Any]:
    """
    Robust pure-Python YAML parser for asset profiles.
    Parses nested mappings, scalar lists, and object lists.
    """
    text_stripped = text.strip()
    if text_stripped.startswith("{"):
        try:
            return json.loads(text)
        except Exception as e:
            raise ValueError(f"Malformed JSON profile: {e}")

    lines = text.splitlines()
    cleaned: List[Tuple[int, str]] = []
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if " #" in line:
            line = line.split(" #")[0]
        if line.count("[") != line.count("]"):
            raise ValueError(f"Unclosed bracket on line {line_num}: {line.strip()}")
        indent = len(line) - len(line.lstrip(" "))
        cleaned.append((indent, line.strip()))

    if not cleaned:
        return {}

    idx = 0

    def parse_scalar(val_str: str) -> Any:
        val_str = val_str.strip()
        if val_str.startswith("[") and val_str.endswith("]"):
            inner = val_str[1:-1].strip()
            if not inner:
                return []
            return [parse_scalar(x) for x in inner.split(",")]
        if val_str.lower() in ("true", "yes"):
            return True
        if val_str.lower() in ("false", "no"):
            return False
        if val_str.lower() in ("null", "none", "~", ""):
            return None
        try:
            if "." in val_str:
                return float(val_str)
            return int(val_str)
        except ValueError:
            if (val_str.startswith('"') and val_str.endswith('"')) or (val_str.startswith("'") and val_str.endswith("'")):
                return val_str[1:-1]
            return val_str

    def parse_node(current_indent: int) -> Any:
        nonlocal idx
        if idx >= len(cleaned):
            return None

        indent, line = cleaned[idx]
        if line.startswith("- "):
            # It's a list at current_indent
            items = []
            while idx < len(cleaned):
                c_indent, c_line = cleaned[idx]
                if c_indent < current_indent:
                    break
                if not c_line.startswith("- "):
                    break
                
                # Consume '- '
                content = c_line[2:].strip()
                idx += 1
                
                if ":" in content and not content.startswith("["):
                    # First key-value of an object inside list item
                    k, v = content.split(":", 1)
                    k, v = k.strip(), v.strip()
                    item_dict: Dict[str, Any] = {}
                    if v:
                        item_dict[k] = parse_scalar(v)
                    else:
                        if idx < len(cleaned) and cleaned[idx][0] > c_indent:
                            item_dict[k] = parse_node(cleaned[idx][0])
                        else:
                            item_dict[k] = None

                    # Collect subsequent keys belonging to this list item
                    while idx < len(cleaned):
                        sub_ind, sub_line = cleaned[idx]
                        if sub_ind <= c_indent or sub_line.startswith("- "):
                            break
                        if ":" in sub_line:
                            sk, sv = sub_line.split(":", 1)
                            sk, sv = sk.strip(), sv.strip()
                            idx += 1
                            if sv:
                                item_dict[sk] = parse_scalar(sv)
                            else:
                                if idx < len(cleaned) and cleaned[idx][0] > sub_ind:
                                    item_dict[sk] = parse_node(cleaned[idx][0])
                                else:
                                    item_dict[sk] = None
                        else:
                            idx += 1
                    items.append(item_dict)
                else:
                    items.append(parse_scalar(content))
            return items
        else:
            # It's a dict at current_indent
            res: Dict[str, Any] = {}
            while idx < len(cleaned):
                c_indent, c_line = cleaned[idx]
                if c_indent < current_indent:
                    break
                if c_line.startswith("- "):
                    break
                if ":" not in c_line:
                    idx += 1
                    continue
                k, v = c_line.split(":", 1)
                k, v = k.strip(), v.strip()
                idx += 1
                if v:
                    res[k] = parse_scalar(v)
                else:
                    if idx < len(cleaned) and cleaned[idx][0] > c_indent:
                        res[k] = parse_node(cleaned[idx][0])
                    else:
                        res[k] = {}
            return res

    result = parse_node(0)
    return result if isinstance(result, dict) else {}


def load_profile_from_dict(data: Dict[str, Any]) -> AssetProfile:
    """Validate and instantiate an AssetProfile from raw dictionary."""
    if not isinstance(data, dict):
        raise ValueError(f"Profile data must be a dictionary, got {type(data).__name__}")

    required_fields = ["asset_type", "criticality_class", "sensors", "failure_modes"]
    for rf in required_fields:
        if rf not in data:
            raise ValueError(f"Profile is missing required field: '{rf}'")

    try:
        crit_class = CriticalityClass(data["criticality_class"])
    except (ValueError, KeyError):
        raise ValueError(f"Invalid criticality_class: '{data.get('criticality_class')}'. Must be A, B, or C.")

    sensors: List[SensorSpec] = []
    for s_raw in data["sensors"]:
        if not isinstance(s_raw, dict):
            raise ValueError(f"Each sensor spec must be a dictionary, got: {s_raw}")
        sensors.append(
            SensorSpec(
                name=s_raw.get("name", ""),
                unit=s_raw.get("unit", ""),
                normal_range=tuple(s_raw.get("normal_range", [])),
                sampling_hz=float(s_raw.get("sampling_hz", 1.0)),
                description=s_raw.get("description", "")
            )
        )

    failure_modes: List[FailureMode] = []
    for fm_raw in data["failure_modes"]:
        if not isinstance(fm_raw, dict):
            raise ValueError(f"Each failure_mode must be a dictionary, got: {fm_raw}")
        failure_modes.append(
            FailureMode(
                name=fm_raw.get("name", ""),
                signature_hints=fm_raw.get("signature_hints", []),
                severity=fm_raw.get("severity", "MEDIUM"),
                primary_sensor=fm_raw.get("primary_sensor", ""),
                description=fm_raw.get("description", "")
            )
        )

    profile = AssetProfile(
        asset_type=data["asset_type"],
        criticality_class=crit_class,
        load_variable=data.get("load_variable", ""),
        sensors=sensors,
        derived_features=data.get("derived_features", []),
        failure_modes=failure_modes,
        manual_references=data.get("manual_references", []),
        description=data.get("description", "")
    )
    profile.validate()
    return profile


def load_profile_from_file(file_path: str) -> AssetProfile:
    """Load and validate an AssetProfile from a YAML or JSON file."""
    p = Path(file_path)
    if not p.exists():
        raise FileNotFoundError(f"Asset profile file not found: {file_path}")

    content = p.read_text(encoding="utf-8")
    try:
        try:
            import yaml
            raw_data = yaml.safe_load(content)
        except ImportError:
            raw_data = parse_simple_yaml(content)
    except Exception as e:
        raise ValueError(f"Malformed profile YAML syntax in {p.name}: {e}")

    if not raw_data or not isinstance(raw_data, dict):
        raise ValueError(f"Profile file {p.name} did not parse into a valid mapping/object.")

    try:
        return load_profile_from_dict(raw_data)
    except Exception as e:
        raise ValueError(f"Validation error in profile {p.name}: {e}")


def load_all_profiles(profiles_dir: str = "assets/profiles") -> Dict[str, AssetProfile]:
    """Scan and load all valid profiles from directory."""
    profiles: Dict[str, AssetProfile] = {}
    path = Path(profiles_dir)
    if not path.exists():
        return profiles

    for f in path.iterdir():
        if f.suffix in [".yaml", ".yml", ".json"]:
            try:
                prof = load_profile_from_file(str(f))
                profiles[prof.asset_type] = prof
            except Exception as e:
                print(f"[Warning] Failed to load {f.name}: {e}")
    return profiles
