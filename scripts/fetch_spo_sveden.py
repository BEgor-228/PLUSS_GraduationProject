"""Fetch SPO sveden pages for accessibility/OVZ info."""
import html as html_lib
import re
import urllib.request
from pathlib import Path

SITES = {
    "medcollege": "https://medel48.gosuslugi.ru",
    "ekit": "https://ekit-elets.gosuslugi.ru",
    "ekepiot": "https://ekepiot.gosuslugi.ru",
}

SUBPATHS = [
    "/svedeniya-ob-organizatsii/",
    "/svedeniya-ob-organizatsii/dokumenty/",
    "/svedeniya-ob-organizatsii/materialno-tehnicheskoe-obespechenie-i-dostupnaya-sreda/",
    "/svedeniya-ob-organizatsii/materialno-tehnicheskoe-obespechenie-dostupnaya-sreda/",
    "/svedeniya-ob-organizatsii/obrazovanie/",
    "/svedeniya-ob-organizatsii/dostupnaya-sreda/",
    "/svedeniya-ob-organizatsii/mto-i-dostupnaya-sreda/",
    "/abiturientam/",
    "/abiturientam/priemnaya-kampaniya/",
]

KEYWORDS = [
    "слух", "зрен", "опорно", "реч", "логопед", "аутист", "множествен", "задержк",
    "умствен", "интеллект", "овз", "инвалид", "пандус", "брайл", "индукц", "вызов",
    "контраст", "эвакуац", "тактиль", "туалет", "подъем", "двер", "акустич", "доступн",
]


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        resp = urllib.request.urlopen(req, timeout=35)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return 0, str(exc)


def extract_links(base: str, html_text: str) -> list[str]:
    links = re.findall(r'href=["\']([^"\']+)["\']', html_text, re.I)
    result = []
    for link in links:
        low = link.lower()
        if any(k in low for k in ["dostup", "material", "mto", "ovz", "invalid", "obraz"]):
            if link.startswith("/"):
                link = base + link
            if link.startswith(base):
                result.append(link)
    return sorted(set(result))


def to_lines(html_text: str) -> list[str]:
    text = re.sub(r"<script.*?</script>", " ", html_text, flags=re.S | re.I)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html_lib.unescape(text)
    return [re.sub(r"\s+", " ", line).strip() for line in text.split("\n") if line.strip()]


def main() -> None:
    out: list[str] = []
    for name, base in SITES.items():
        out.append("=" * 80)
        out.append(name)
        out.append("=" * 80)
        status, html_text = fetch(base + "/svedeniya-ob-organizatsii/")
        out.append(f"sveden status={status}")
        if status == 200:
            out.append("Discovered links:")
            for link in extract_links(base, html_text)[:40]:
                out.append(f"  {link}")

        urls = [base + p for p in SUBPATHS]
        if status == 200:
            urls.extend(extract_links(base, html_text))

        seen = set()
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            st, content = fetch(url)
            if st != 200:
                continue
            lines = to_lines(content)
            hits = [line for line in lines if any(k in line.lower() for k in KEYWORDS)]
            if hits or "доступн" in content.lower():
                out.append(f"\n--- OK {url} ({len(hits)} keyword hits) ---")
                for hit in hits[:25]:
                    out.append(hit[:450])

    out_path = Path(__file__).resolve().parent / "fetch_spo_sveden_output.txt"
    out_path.write_text("\n".join(out), encoding="utf-8")
    print(f"written {out_path}")


if __name__ == "__main__":
    main()
