"""Temporary scraper for institution accessibility/OVZ pages."""
import html as html_lib
import re
import urllib.error
import urllib.request
from pathlib import Path

INSTITUTIONS = {
    "medcollege": {
        "name": "Елецкий медицинский колледж",
        "base": "https://medel48.gosuslugi.ru",
    },
    "internat": {
        "name": "Школа-интернат г. Ельца",
        "base": "https://shkola-internat-elets.gosuslugi.ru",
    },
    "ekit": {
        "name": "Елецкий колледж инновационных технологий",
        "base": "https://ekit-elets.gosuslugi.ru",
    },
    "ekepiot": {
        "name": "ЕКЭП и ОТ",
        "base": "https://ekepiot.gosuslugi.ru",
    },
}

CANDIDATE_PATHS = [
    "/svedeniya-ob-obrazovatelnoy-organizatsii/materialno-tehnicheskoe-obespechenie-dostupnaya-sreda/",
    "/sveden/objects/",
    "/sveden/common/",
    "/sveden/mtl/",
    "/roditelyam-i-uchenikam/poleznaya-informatsiya/detyam-s-ogranichennymi-vozmozhnostyami-zdorovya/",
    "/svedeniya-ob-obrazovatelnoy-organizatsii/obrazovanie/",
    "/abiturientam/",
    "/svedeniya-ob-obrazovatelnoy-organizatsii/",
]

CONDITION_TERMS = {
    "hearing": ["слух", "сурдо", "глух", "слабослыш"],
    "vision": ["зрен", "тифло", "слеп", "слабовид"],
    "musculoskeletal": ["опорно", "двигат", "дцп", "коляс", "опорно-двиг"],
    "speech": ["реч", "логопед", "заик"],
    "mental_retardation": ["задержк", "умствен", "интеллект"],
    "autism": ["аутист", "аутизм", "рас ", "рас,", "рас."],
    "multiple": ["множествен", "комбинир"],
    "general_ovz": ["овз", "инвалид", "адаптир", "коррекц", "инклюз", "особые условия"],
}

ACCESS_TERMS = {
    "ramps": ["пандус"],
    "sanitary": ["туалет", "санитар", "гигиен", "душ"],
    "acoustic": ["акустич", "индукц", "слухов"],
    "call_system": ["кнопк", "вызов", "вызова помощ"],
    "braille": ["брайл", "рельефно-точеч", "рельефно точеч"],
    "contrast": ["контраст"],
    "entrance": ["входн", "двер", "проем", "порог"],
    "ramps_lifts": ["подъемник", "лифт", "пандус"],
    "evacuation": ["эвакуац", "безопасност"],
    "tactile": ["тактиль", "тифлотех", "напольн", "указател", "маршрут"],
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=35).read()
    for enc in ("utf-8", "cp1251"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def to_lines(html_text: str) -> list[str]:
    text = re.sub(r"<script.*?</script>", " ", html_text, flags=re.S | re.I)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html_lib.unescape(text)
    return [re.sub(r"\s+", " ", line).strip() for line in text.split("\n") if line.strip()]


def match_lines(lines: list[str], terms: list[str]) -> list[str]:
    hits: list[str] = []
    for line in lines:
        low = line.lower()
        if any(term in low for term in terms):
            if line not in hits:
                hits.append(line)
    return hits


def main() -> None:
    out: list[str] = []
    for key, info in INSTITUTIONS.items():
        out.append("=" * 80)
        out.append(f"{info['name']} ({info['base']})")
        out.append("=" * 80)
        found_pages: list[tuple[str, list[str], int]] = []
        for path in CANDIDATE_PATHS:
            url = info["base"] + path
            try:
                text = fetch(url)
                lines = to_lines(text)
                if len(lines) < 5:
                    continue
                all_terms = sum(CONDITION_TERMS.values(), []) + sum(ACCESS_TERMS.values(), [])
                score = sum(1 for line in lines for term in all_terms if term in line.lower())
                if score >= 2 or "доступн" in text.lower():
                    found_pages.append((url, lines, score))
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
                out.append(f"ERR {url}: {exc}")
        found_pages.sort(key=lambda item: -item[2])
        out.append(f"Found {len(found_pages)} relevant pages")
        for url, lines, score in found_pages[:4]:
            out.append(f"--- PAGE score={score}: {url} ---")
            out.append("CONDITIONS:")
            for cat, terms in CONDITION_TERMS.items():
                hits = match_lines(lines, terms)
                if hits:
                    out.append(f"  [{cat}] ({len(hits)} lines)")
                    for hit in hits[:5]:
                        out.append(f"    - {hit[:400]}")
            out.append("ACCESSIBILITY:")
            for cat, terms in ACCESS_TERMS.items():
                hits = match_lines(lines, terms)
                if hits:
                    out.append(f"  [{cat}] ({len(hits)} lines)")
                    for hit in hits[:4]:
                        out.append(f"    - {hit[:400]}")
            out.append("")

    out_path = Path(__file__).resolve().parent.parent / "scripts" / "scrape_accessibility_output.txt"
    out_path.write_text("\n".join(out), encoding="utf-8")
    print(f"written {out_path} ({len(out)} lines)")


def discover_links() -> None:
    bases = [
        "https://medel48.gosuslugi.ru/",
        "https://ekit-elets.gosuslugi.ru/",
        "https://ekepiot.gosuslugi.ru/",
    ]
    out: list[str] = []
    for base in bases:
        out.append(f"==== {base} ====")
        html_text = fetch(base)
        links = set(re.findall(r'href=["\']([^"\']+)["\']', html_text, re.I))
        keywords = ["dostup", "sved", "obraz", "ovz", "invalid", "material", "mtl", "objects", "abit"]
        matched = sorted(link for link in links if any(k in link.lower() for k in keywords))
        for link in matched:
            out.append(link)
        out.append(f"matched {len(matched)} / total {len(links)}")
        out.append("")
    path = Path(__file__).resolve().parent / "discover_links_output.txt"
    path.write_text("\n".join(out), encoding="utf-8")
    print(f"written {path}")


if __name__ == "__main__":
    discover_links()
    main()
