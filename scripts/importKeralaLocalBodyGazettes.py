#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


PANCHAYAT_SOURCE_URL = "https://sec.kerala.gov.in/public/elercd/download/db3d5c61-cc49-48d5-991f-d207bd159562"
MUNICIPAL_SOURCE_URL = "https://sec.kerala.gov.in/public/elercd/download/90941035-a6b5-46e0-b20d-667aa9894a46"

DEFAULT_PANCHAYAT_PDF = Path("/tmp/kerala-panchayat-winners.pdf")
DEFAULT_MUNICIPAL_PDF = Path("/tmp/kerala-municipal-winners.pdf")
DEFAULT_OUTPUT = Path("data/kerala/representatives/kerala_local_body_members.official.csv")
DEFAULT_PANCHAYAT_DIR = Path("data/kerala/gazettes/panchayat")
DEFAULT_SOURCE_MANIFEST = Path("data/kerala/gazettes/source_manifest.json")
DEFAULT_OCR_CLEANUP = Path("data/kerala/gazettes/ocr_cleanup.json")
DEFAULT_MANUAL_CORRECTIONS = Path("data/kerala/gazettes/manual_corrections.json")

HEADER_RE = re.compile(r"^\s*\d+\s+([DBGMC]\d{5})\s*-\s*(.*?)\s+(\d{3})\s*-\s*(.*)$")
FOOTER_PREFIXES = (
    "This is a digitally signed Gazette.",
    "Authenticity may be verified through",
)

KERALA_DISTRICT_CODE_MAP = {
    "01": "Thiruvananthapuram",
    "02": "Kollam",
    "03": "Pathanamthitta",
    "04": "Alappuzha",
    "05": "Kottayam",
    "06": "Idukki",
    "07": "Ernakulam",
    "08": "Thrissur",
    "09": "Palakkad",
    "10": "Malappuram",
    "11": "Kozhikode",
    "12": "Wayanad",
    "13": "Kannur",
    "14": "Kasaragod",
}

KERALA_DISTRICT_ABBR = {
    "01": "TVM",
    "02": "KLM",
    "03": "PTA",
    "04": "ALP",
    "05": "KTM",
    "06": "IDK",
    "07": "ERN",
    "08": "TSR",
    "09": "PKD",
    "10": "MLP",
    "11": "KKD",
    "12": "WYD",
    "13": "KNR",
    "14": "KSD",
}

LOCAL_BODY_META = {
    "D": {
        "local_body_type": "district_panchayat",
        "office_level": "other_local_representative",
        "office_title": "District Panchayat Member",
        "jurisdiction_type": "other",
        "code_prefix": "DP",
    },
    "B": {
        "local_body_type": "block_panchayat",
        "office_level": "other_local_representative",
        "office_title": "Block Panchayat Member",
        "jurisdiction_type": "other",
        "code_prefix": "BP",
    },
    "G": {
        "local_body_type": "grama_panchayat",
        "office_level": "panchayat_member",
        "office_title": "Grama Panchayat Member",
        "jurisdiction_type": "ward",
        "code_prefix": "GP",
    },
    "M": {
        "local_body_type": "municipality",
        "office_level": "municipal_councillor",
        "office_title": "Municipal Councillor",
        "jurisdiction_type": "ward",
        "code_prefix": "MUN",
    },
    "C": {
        "local_body_type": "corporation",
        "office_level": "municipal_councillor",
        "office_title": "Corporation Councillor",
        "jurisdiction_type": "ward",
        "code_prefix": "CORP",
    },
}

OCR_REPLACEMENTS = {
    "  ": " ",
    "( ": "(",
    " )": ")",
    " ,": ",",
    " .": ".",
    " - ": "-",
    " -": "-",
    "- ": "-",
    " . ": ". ",
}

MALAYALAM_ROMAN = {
    "അ": "a",
    "ആ": "aa",
    "ഇ": "i",
    "ഈ": "ee",
    "ഉ": "u",
    "ഊ": "oo",
    "ഋ": "ri",
    "എ": "e",
    "ഏ": "ee",
    "ഐ": "ai",
    "ഒ": "o",
    "ഓ": "oo",
    "ഔ": "au",
    "ക": "ka",
    "ഖ": "kha",
    "ഗ": "ga",
    "ഘ": "gha",
    "ങ": "nga",
    "ച": "cha",
    "ഛ": "chha",
    "ജ": "ja",
    "ഝ": "jha",
    "ഞ": "nya",
    "ട": "ta",
    "ഠ": "tha",
    "ഡ": "da",
    "ഢ": "dha",
    "ണ": "na",
    "ത": "tha",
    "ഥ": "thha",
    "ദ": "dha",
    "ധ": "dhha",
    "ന": "na",
    "പ": "pa",
    "ഫ": "pha",
    "ബ": "ba",
    "ഭ": "bha",
    "മ": "ma",
    "യ": "ya",
    "ര": "ra",
    "റ": "rra",
    "ല": "la",
    "ള": "lla",
    "ഴ": "zha",
    "വ": "va",
    "ശ": "sha",
    "ഷ": "ssha",
    "സ": "sa",
    "ഹ": "ha",
    "ൿ": "k",
    "ം": "m",
    "ഃ": "h",
    "്": "",
    "ാ": "a",
    "ി": "i",
    "ീ": "ee",
    "ു": "u",
    "ൂ": "oo",
    "ൃ": "ri",
    "െ": "e",
    "േ": "ee",
    "ൈ": "ai",
    "ൊ": "o",
    "ോ": "oo",
    "ൌ": "au",
    "്ര": "ra",
    "ൺ": "n",
    "ൻ": "n",
    "ർ": "r",
    "ൽ": "l",
    "ൾ": "l",
    "ൗ": "au",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract Kerala SEC local-body winners from official gazette PDFs into representative CSV."
    )
    parser.add_argument("--state", default="Kerala")
    parser.add_argument("--district", default="")
    parser.add_argument("--source-last-updated", default="2026-03-12")
    parser.add_argument("--term-start", default="2025-12-19")
    parser.add_argument("--term-end", default="2030-12-18")
    parser.add_argument("--panchayat-pdf", action="append", type=Path, default=[])
    parser.add_argument("--panchayat-dir", type=Path, default=DEFAULT_PANCHAYAT_DIR)
    parser.add_argument("--municipal-pdf", type=Path, default=DEFAULT_MUNICIPAL_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-manifest", type=Path, default=DEFAULT_SOURCE_MANIFEST)
    parser.add_argument("--ocr-cleanup", type=Path, default=DEFAULT_OCR_CLEANUP)
    parser.add_argument("--manual-corrections", type=Path, default=DEFAULT_MANUAL_CORRECTIONS)
    parser.add_argument("--download-missing", action="store_true")
    parser.add_argument("--no-transliteration", action="store_true")
    return parser.parse_args()


def download_if_missing(path: Path, url: str):
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=30) as response:
        path.write_bytes(response.read())


def pdf_text(path: Path):
    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def load_source_manifest(path: Path):
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_ocr_cleanup(path: Path):
    if not path.exists():
        return {"phrase_replacements": [], "transliteration_strip_chars": []}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_manual_corrections(path: Path):
    if not path.exists():
        return {"by_jurisdiction_code": {}, "by_local_body_name": {}}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clean_line(line: str):
    text = unicodedata.normalize("NFKC", line)
    return re.sub(r"\s+", " ", text).strip()


def normalize_ocr_text(text: str, cleanup_config):
    value = clean_line(text)
    for old, new in OCR_REPLACEMENTS.items():
        value = value.replace(old, new)
    for item in cleanup_config.get("phrase_replacements", []):
        value = value.replace(item["from"], item["to"])
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -")


def transliterate_to_latin(text: str, cleanup_config):
    output = []
    strip_chars = set(cleanup_config.get("transliteration_strip_chars", []))
    for char in normalize_ocr_text(text, cleanup_config):
        if char in strip_chars:
            continue
        output.append(MALAYALAM_ROMAN.get(char, char))
    value = "".join(output)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def district_from_body_code(body_code: str):
    district_code = body_code[1:3]
    district_name = KERALA_DISTRICT_CODE_MAP.get(district_code)
    if not district_name:
        raise ValueError(f"Unknown Kerala district code in body code: {body_code}")
    return district_code, district_name


def build_jurisdiction_code(body_code: str, ward_code: str):
    district_code, _district_name = district_from_body_code(body_code)
    meta = LOCAL_BODY_META[body_code[0]]
    district_abbr = KERALA_DISTRICT_ABBR[district_code]
    if body_code[0] in ("D", "B"):
        return f"IN-KL-{district_abbr}-{meta['code_prefix']}-{body_code}-{ward_code}"
    return f"IN-KL-{district_abbr}-{meta['code_prefix']}-{body_code}-W{ward_code}"


def is_address_line(line: str):
    if re.search(r"\d", line):
        return True
    if "," in line:
        return True
    if "പി.ഒ" in line or "പി ഒ" in line:
        return True
    return False


def rows_from_pdf(text: str, source_url: str, cleanup_config):
    lines = text.splitlines()
    rows = []
    current = None

    def finalize():
        nonlocal current
        if not current:
            return

        name_lines = [normalize_ocr_text(line, cleanup_config) for line in current["name_lines"] if normalize_ocr_text(line, cleanup_config)]
        if current["header_tail_was_empty"] and len(name_lines) > 1:
            name_lines = name_lines[1:]

        full_name = normalize_ocr_text(" ".join(name_lines), cleanup_config)
        if not full_name:
            current = None
            return

        row = {
            "body_code": current["body_code"],
            "body_name": normalize_ocr_text(current["body_name"], cleanup_config),
            "ward_code": current["ward_code"],
            "ward_name": normalize_ocr_text(current["ward_name"], cleanup_config),
            "full_name": full_name,
            "source_url": source_url,
        }
        rows.append(row)
        current = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue
        if any(line.startswith(prefix) for prefix in FOOTER_PREFIXES):
            continue
        if re.fullmatch(r"\d+", line):
            continue

        header_match = HEADER_RE.match(line)
        if header_match:
            finalize()
            body_code = header_match.group(1).strip()
            body_name = header_match.group(2).strip()
            ward_code = header_match.group(3).strip()
            ward_name = header_match.group(4).strip()
            current = {
                "body_code": body_code,
                "body_name": body_name,
                "ward_code": ward_code,
                "ward_name": ward_name,
                "header_tail_was_empty": normalize_ocr_text(ward_name, cleanup_config) == "",
                "name_lines": [],
            }
            continue

        if not current:
            continue

        if is_address_line(line):
            continue

        current["name_lines"].append(line)

    finalize()
    return rows


def apply_manual_corrections(output, corrections):
    body_name_fix = corrections.get("by_local_body_name", {}).get(output["local_body_name"], {})
    output.update(body_name_fix)

    code_fix = corrections.get("by_jurisdiction_code", {}).get(output["jurisdiction_code"], {})
    output.update(code_fix)
    return output


def build_output_rows(extracted_rows, args, cleanup_config, manual_corrections):
    output_rows = []
    seen = set()

    for row in extracted_rows:
        body_code = row["body_code"]
        district_code, district_name = district_from_body_code(body_code)
        if args.district and district_name.lower() != args.district.lower():
            continue

        meta = LOCAL_BODY_META.get(body_code[0])
        if not meta:
            continue

        normalized_name = normalize_ocr_text(row["full_name"], cleanup_config)
        transliterated_name = "" if args.no_transliteration else transliterate_to_latin(normalized_name, cleanup_config)
        block_value = row["body_name"] if meta["local_body_type"] == "block_panchayat" else ""

        output = {
            "country": "IN",
            "full_name": normalized_name,
            "office_level": meta["office_level"],
            "office_title": meta["office_title"],
            "jurisdiction_type": meta["jurisdiction_type"],
            "jurisdiction_code": build_jurisdiction_code(body_code, row["ward_code"]),
            "state": args.state,
            "district": district_name,
            "block": block_value,
            "ward": row["ward_code"],
            "local_body_type": meta["local_body_type"],
            "local_body_name": row["body_name"],
            "normalized_name": normalized_name,
            "transliterated_name": transliterated_name,
            "party": "Unknown",
            "term_start": args.term_start,
            "term_end": args.term_end,
            "source_url": row["source_url"],
            "source_last_updated": args.source_last_updated,
            "status": "active",
        }
        output = apply_manual_corrections(output, manual_corrections)
        if not output.get("normalized_name"):
            output["normalized_name"] = output["full_name"]
        if not output.get("transliterated_name") and not args.no_transliteration:
            output["transliterated_name"] = transliterate_to_latin(output["normalized_name"], cleanup_config)
        output["full_name"] = output["normalized_name"]

        dedupe_key = (output["jurisdiction_code"], output["full_name"])
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        output_rows.append(output)

    output_rows.sort(key=lambda item: item["jurisdiction_code"])
    return output_rows


def write_csv(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "country",
        "full_name",
        "office_level",
        "office_title",
        "jurisdiction_type",
        "jurisdiction_code",
        "state",
        "district",
        "block",
        "ward",
        "local_body_type",
        "local_body_name",
        "normalized_name",
        "transliterated_name",
        "party",
        "term_start",
        "term_end",
        "source_url",
        "source_last_updated",
        "status",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_qa_report(rows, manifest):
    expected_districts = sorted(KERALA_DISTRICT_CODE_MAP.values())
    panchayat_source_districts = sorted(manifest.get("panchayat", {}).keys())
    district_summary = {}

    for district in expected_districts:
        district_rows = [row for row in rows if row["district"] == district]
        body_types = sorted({row["local_body_type"] for row in district_rows if row.get("local_body_type")})
        counts = {}
        for row in district_rows:
            counts[row["local_body_type"]] = counts.get(row["local_body_type"], 0) + 1

        has_panchayat_rows = any(
            body_type in counts for body_type in ("district_panchayat", "block_panchayat", "grama_panchayat")
        )
        has_municipal_rows = any(body_type in counts for body_type in ("municipality", "corporation"))
        issues = []

        if district not in panchayat_source_districts:
            issues.append("missing_official_panchayat_source")
        elif not has_panchayat_rows:
            issues.append("missing_panchayat_rows")

        if not has_municipal_rows:
            issues.append("missing_municipal_rows")

        district_summary[district] = {
            "records": len(district_rows),
            "localBodyTypes": body_types,
            "countsByLocalBodyType": counts,
            "hasPanchayatRows": has_panchayat_rows,
            "hasMunicipalRows": has_municipal_rows,
            "status": "pass" if not issues else "warn",
            "issues": issues
        }

    overall_issues = [district for district, summary in district_summary.items() if summary["issues"]]
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "expectedDistricts": expected_districts,
        "panchayatSourceDistricts": panchayat_source_districts,
        "districtSummary": district_summary,
        "warnings": overall_issues,
    }


def write_qa_report(output_path: Path, qa_report):
    qa_path = output_path.with_suffix(".qa.json")
    qa_path.write_text(json.dumps(qa_report, indent=2, ensure_ascii=False), encoding="utf-8")
    return qa_path


def ensure_source_files(args):
    manifest = load_source_manifest(args.source_manifest)

    if args.download_missing and manifest:
        args.panchayat_dir.mkdir(parents=True, exist_ok=True)
        for district, url in manifest.get("panchayat", {}).items():
            download_if_missing(args.panchayat_dir / f"{district.lower().replace(' ', '_')}.pdf", url)
        municipal_url = manifest.get("municipal")
        if municipal_url:
            download_if_missing(args.municipal_pdf, municipal_url)

    panchayat_paths = list(args.panchayat_pdf)
    if args.panchayat_dir.exists():
        panchayat_paths.extend(sorted(args.panchayat_dir.glob("*.pdf")))
    if not panchayat_paths and DEFAULT_PANCHAYAT_PDF.exists():
        panchayat_paths.append(DEFAULT_PANCHAYAT_PDF)

    deduped = []
    seen = set()
    for path in panchayat_paths:
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        deduped.append(path)

    return deduped


def main():
    args = parse_args()

    panchayat_paths = ensure_source_files(args)
    if not panchayat_paths:
        raise FileNotFoundError("No panchayat gazette PDFs found. Provide --panchayat-pdf, populate the panchayat directory, or use --download-missing with a source manifest.")
    if not args.municipal_pdf.exists():
        raise FileNotFoundError(f"Missing municipal PDF: {args.municipal_pdf}")

    all_rows = []
    manifest = load_source_manifest(args.source_manifest)
    cleanup_config = load_ocr_cleanup(args.ocr_cleanup)
    manual_corrections = load_manual_corrections(args.manual_corrections)
    panchayat_urls = manifest.get("panchayat", {})

    for pdf_path in panchayat_paths:
        district_key = pdf_path.stem.replace("_", " ").title()
        source_url = panchayat_urls.get(district_key, PANCHAYAT_SOURCE_URL)
        all_rows.extend(rows_from_pdf(pdf_text(pdf_path), source_url, cleanup_config))

    all_rows.extend(rows_from_pdf(pdf_text(args.municipal_pdf), manifest.get("municipal", MUNICIPAL_SOURCE_URL), cleanup_config))
    output_rows = build_output_rows(all_rows, args, cleanup_config, manual_corrections)

    if not output_rows:
        raise RuntimeError("No Kerala local-body members were extracted from the gazettes.")

    write_csv(args.output, output_rows)
    qa_report = build_qa_report(output_rows, manifest)
    qa_path = write_qa_report(args.output, qa_report)

    district_counts = {}
    level_counts = {}
    for row in output_rows:
        district_counts[row["district"]] = district_counts.get(row["district"], 0) + 1
        level_counts[row["office_level"]] = level_counts.get(row["office_level"], 0) + 1

    print(f"Wrote {len(output_rows)} rows to {args.output}")
    for key in sorted(level_counts):
        print(f"{key}: {level_counts[key]}")
    print("districts:", len(district_counts))
    print(f"qa: {qa_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
