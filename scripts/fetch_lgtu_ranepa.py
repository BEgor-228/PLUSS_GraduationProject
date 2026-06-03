"""Fetch LGTU objects/ovz and probe RANEPA site."""
import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "ru-RU,ru;q=0.9",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=25).read().decode("utf-8", errors="replace")


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text)


def extract_keywords(text: str, keywords: list[str], limit: int = 2) -> None:
    low = text.lower()
    for kw in keywords:
        pos = 0
        found = 0
        while found < limit:
            idx = low.find(kw, pos)
            if idx < 0:
                break
            snippet = text[max(0, idx - 40) : idx + 120]
            print(f"  [{kw}] {snippet}")
            pos = idx + len(kw)
            found += 1


KEYWORDS = [
    "слух",
    "зрен",
    "опорно",
    "реч",
    "аутист",
    "умствен",
    "задержк",
    "пандус",
    "подъем",
    "лифт",
    "индук",
    "брайл",
    "эвакуац",
    "помощник",
    "ассистент",
    "тактил",
    "контраст",
    "санитар",
    "тифло",
    "сурдо",
    "кнопка вызова",
    "мнемосхем",
    "общежит",
]

out_lines: list[str] = []

for url in [
    "https://www.stu.lipetsk.ru/sveden/objects/",
    "https://www.stu.lipetsk.ru/sveden/ovz/",
]:
    out_lines.append(f"\n=== {url} ===\n")
    try:
        text = strip_html(fetch(url))
        out_lines.append(f"len={len(text)}\n")
        import io

        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        extract_keywords(text, KEYWORDS)
        sys.stdout = old
        out_lines.append(buf.getvalue())
    except Exception as exc:
        out_lines.append(f"ERR: {exc}\n")

out_lines.append("\n=== RANEPA probe ===\n")
for url in [
    "https://lip.ranepa.ru/",
    "https://lip.ranepa.ru/sveden/objects",
    "https://lip.ranepa.ru/news/",
]:
    try:
        html = fetch(url)
        text = strip_html(html)
        out_lines.append(f"{url} len={len(text)}\n")
        if len(text) > 500:
            out_lines.append(text[:800] + "\n...\n")
    except Exception as exc:
        out_lines.append(f"{url} ERR: {exc}\n")

path = __file__.replace("fetch_lgtu_ranepa.py", "fetch_lgtu_ranepa_output.txt")
with open(path, "w", encoding="utf-8") as f:
    f.write("".join(out_lines))
print("Wrote", path)
