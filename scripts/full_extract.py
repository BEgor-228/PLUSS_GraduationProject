"""Extract full accessibility/OVZ text from specific institution pages."""
import html as html_lib
import re
import urllib.request
from pathlib import Path

PAGES = {
    "medcollege_mto": "https://medel48.gosuslugi.ru/svedeniya-ob-organizatsii/materialno-tehnicheskoe-obespechenie-i-dostupnaya-sreda/",
    "medcollege_docs": "https://medel48.gosuslugi.ru/svedeniya-ob-organizatsii/dokumenty/",
    "internat_mto": "https://shkola-internat-elets.gosuslugi.ru/svedeniya-ob-obrazovatelnoy-organizatsii/materialno-tehnicheskoe-obespechenie-dostupnaya-sreda/",
    "internat_edu": "https://shkola-internat-elets.gosuslugi.ru/svedeniya-ob-obrazovatelnoy-organizatsii/obrazovanie/",
    "internat_ovz": "https://shkola-internat-elets.gosuslugi.ru/roditelyam-i-uchenikam/poleznaya-informatsiya/detyam-s-ogranichennymi-vozmozhnostyami-zdorovya/",
    "ekit_mto": "https://ekit-elets.gosuslugi.ru/svedeniya-ob-organizatsii/materialno-tehnicheskoe-obespechenie-i-dostupnaya-sreda/",
    "ekepiot_mto": "https://ekepiot.gosuslugi.ru/svedeniya-ob-organizatsii/materialno-tehnicheskoe-obespechenie-i-dostupnaya-sreda/",
    "ekepiot_abit": "https://ekepiot.gosuslugi.ru/abiturientam/",
}

KEYWORDS = [
    "слух", "зрен", "опорно", "реч", "логопед", "аутист", "множествен", "задержк",
    "умствен", "интеллект", "овз", "инвалид", "пандус", "брайл", "индукц", "вызов",
    "контраст", "эвакуац", "тактиль", "туалет", "подъем", "двер", "акустич", "доступн",
    "лифт", "порог", "маршрут", "паспорт", "тифло", "слабослыш", "слабовид", "дцп",
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", errors="replace")


def to_lines(html_text: str) -> list[str]:
    text = re.sub(r"<script.*?</script>", " ", html_text, flags=re.S | re.I)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html_lib.unescape(text)
    return [re.sub(r"\s+", " ", line).strip() for line in text.split("\n") if line.strip()]


def main() -> None:
    out: list[str] = []
    for name, url in PAGES.items():
        out.append("=" * 80)
        out.append(f"{name}: {url}")
        out.append("=" * 80)
        lines = to_lines(fetch(url))
        hits = [line for line in lines if any(k in line.lower() for k in KEYWORDS)]
        out.append(f"Total lines: {len(lines)}, keyword hits: {len(hits)}")
        for line in hits:
            out.append(line)
        out.append("")
    path = Path(__file__).resolve().parent / "full_extract_output.txt"
    path.write_text("\n".join(out), encoding="utf-8")
    print(f"written {path}")


if __name__ == "__main__":
    main()
