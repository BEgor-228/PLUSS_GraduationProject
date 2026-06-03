"""Scrape VO institution sites for OVZ conditions and physical accessibility."""
import html as html_lib
import re
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

INSTITUTIONS = {
    "lspu": {
        "name": "ЛГПУ им. П.П. Семенова-Тян-Шанского",
        "base": "https://lspu-lipetsk.ru",
    },
    "lgtu": {
        "name": "ЛГТУ (stu.lipetsk.ru)",
        "base": "https://www.stu.lipetsk.ru",
    },
    "lik": {
        "name": "ЛИК (lki-lipetsk.ru)",
        "base": "https://lki-lipetsk.ru",
    },
    "mgutu": {
        "name": "ЛКИТиУ (филиал МГУТУ)",
        "base": "https://www.mgutu48.ru",
    },
    "ranepa": {
        "name": "Липецкий филиал РАНХиГС",
        "base": "https://lip.ranepa.ru",
    },
}

CANDIDATE_PATHS = [
    "/sveden/objects/",
    "/sveden/common/",
    "/sveden/mtl/",
    "/sveden/",
    "/svedeniya-ob-obrazovatelnoy-organizatsii/materialno-tehnicheskoe-obespechenie-dostupnaya-sreda/",
    "/svedeniya-ob-obrazovatelnoy-organizatsii/materialno-tehnicheskoe-obespechenie-i-dostupnaya-sreda/",
    "/svedeniya-ob-organizatsii/materialno-tehnicheskoe-obespechenie-i-dostupnaya-sreda/",
    "/svedeniya-ob-organizatsii/",
    "/svedeniya-ob-obrazovatelnoy-organizatsii/",
    "/about/sveden/objects/",
    "/about/sveden/mtl/",
    "/about/sveden/common/",
    "/svedeniya-ob-obrazovatelnoj-organizacii/materialno-tehnicheskoe-obespechenie-dostupnaya-sreda/",
    "/abiturientam/",
    "/abitur/",
    "/priem/",
]

CONDITION_TERMS = {
    "hearing": ["слух", "сурдо", "глух", "слабослыш"],
    "vision": ["зрен", "тифло", "слеп", "слабовид"],
    "musculoskeletal": ["опорно", "двигат", "дцп", "коляс", "опорно-двиг"],
    "speech": ["реч", "логопед", "заик"],
    "mental_retardation": ["задержк", "умствен", "интеллект"],
    "autism": ["аутист", "аутизм"],
    "multiple": ["множествен", "комбинир"],
    "general_ovz": ["овз", "инвалид", "адаптир", "инклюз", "особые условия", "доступн"],
}

ACCESS_TERMS = {
    "ramps": ["пандус"],
    "sanitary": ["туалет", "санитар", "гигиен", "душ"],
    "acoustic": ["акустич", "индукц", "слухов", "fm-при"],
    "call_system": ["кнопк", "вызов", "вызова помощ", "помощник"],
    "braille": ["брайл", "рельефно-точеч", "рельефно точеч", "тактильное табло"],
    "contrast": ["контраст"],
    "entrance": ["входн", "двер", "проем", "порог"],
    "ramps_lifts": ["подъемник", "лифт", "пандус", "микролифт"],
    "evacuation": ["эвакуац"],
    "tactile": ["тактиль", "тифлотех", "напольн", "указател", "маршрут", "мнемосхем"],
}

DISCOVER_KEYWORDS = ["dostup", "sved", "obraz", "ovz", "invalid", "material", "mtl", "objects", "abit", "priem"]


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        resp = urllib.request.urlopen(req, timeout=40)
        raw = resp.read()
        for enc in ("utf-8", "cp1251", "windows-1251"):
            try:
                return resp.status, raw.decode(enc)
            except UnicodeDecodeError:
                continue
        return resp.status, raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, str(exc)
    except Exception as exc:
        return 0, str(exc)


def to_lines(html_text: str) -> list[str]:
    text = re.sub(r"<script.*?</script>", " ", html_text, flags=re.S | re.I)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html_lib.unescape(text)
    return [re.sub(r"\s+", " ", line).strip() for line in text.split("\n") if line.strip()]


def discover_links(base: str, html_text: str) -> list[str]:
    links = re.findall(r'href=["\']([^"\']+)["\']', html_text, re.I)
    found = set()
    for link in links:
        low = link.lower()
        if not any(k in low for k in DISCOVER_KEYWORDS):
            continue
        full = urljoin(base + "/", link)
        if urlparse(full).netloc == urlparse(base).netloc:
            found.add(full.split("#")[0].rstrip("/") + ("/" if link.endswith("/") else ""))
    return sorted(found)


def match_lines(lines: list[str], terms: list[str]) -> list[str]:
    hits: list[str] = []
    for line in lines:
        low = line.lower()
        if any(term in low for term in terms):
            if "рас" in terms and "рас" in low:
                if re.search(r"\bрас\b|\bрас,|\bрас\.|аутист|распис", low):
                    pass
            if line not in hits:
                hits.append(line)
    return hits


def analyze_page(url: str, lines: list[str]) -> dict:
    result = {"conditions": {}, "accessibility": {}}
    for cat, terms in CONDITION_TERMS.items():
        hits = match_lines(lines, terms)
        if cat == "autism":
            hits = [h for h in hits if any(x in h.lower() for x in ["аутист", "аутизм", "рас ", "рас,", "рас."])]
        if hits:
            result["conditions"][cat] = hits
    for cat, terms in ACCESS_TERMS.items():
        hits = match_lines(lines, terms)
        if hits:
            result["accessibility"][cat] = hits
    return result


def main() -> None:
    out: list[str] = []
    for key, info in INSTITUTIONS.items():
        base = info["base"].rstrip("/")
        out.append("=" * 80)
        out.append(f"{info['name']} | {base}")
        out.append("=" * 80)

        urls_to_try = [base + p for p in CANDIDATE_PATHS]
        for start in [base + "/", base + "/index.php", base + "/sveden/"]:
            st, html_text = fetch(start)
            if st == 200 and len(html_text) > 500:
                urls_to_try.extend(discover_links(base, html_text))

        seen = set()
        pages_data: list[tuple[str, dict, int]] = []
        for url in urls_to_try:
            url = url.rstrip("/")
            if not url or url in seen:
                continue
            seen.add(url)
            st, content = fetch(url)
            if st != 200 or len(content) < 200:
                continue
            lines = to_lines(content)
            all_kw = sum(CONDITION_TERMS.values(), []) + sum(ACCESS_TERMS.values(), [])
            score = sum(1 for line in lines for kw in all_kw if kw in line.lower())
            if score >= 2 or "доступн" in content.lower() or "/sveden/" in url or "materialno" in url:
                pages_data.append((url, analyze_page(url, lines), score))

        pages_data.sort(key=lambda x: -x[2])
        out.append(f"Relevant pages found: {len(pages_data)}")
        for url, data, score in pages_data[:5]:
            out.append(f"\n--- {url} (score={score}) ---")
            out.append("CONDITIONS:")
            for cat, hits in data["conditions"].items():
                out.append(f"  [{cat}]")
                for h in hits[:5]:
                    out.append(f"    - {h[:420]}")
            out.append("ACCESSIBILITY:")
            for cat, hits in data["accessibility"].items():
                out.append(f"  [{cat}]")
                for h in hits[:4]:
                    out.append(f"    - {h[:420]}")
        out.append("")

    out_path = Path(__file__).resolve().parent / "scrape_vo_output.txt"
    out_path.write_text("\n".join(out), encoding="utf-8")
    print(f"written {out_path}")


if __name__ == "__main__":
    main()
