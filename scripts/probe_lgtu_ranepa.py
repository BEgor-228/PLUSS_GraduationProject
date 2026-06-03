import re
import urllib.request
from html import unescape

SITES = {
    "lgtu": "https://www.stu.lipetsk.ru",
    "ranepa": "https://lip.ranepa.ru",
}
PATHS = [
    "/sveden/objects",
    "/sveden/mtl",
    "/sveden/common",
    "/sveden/",
    "/sveden/education",
    "/sveden/document",
    "/sveden/struct",
]
KEYWORDS = [
    "пандус", "брайл", "индукц", "слух", "зрен", "опорно", "инвалид", "овз",
    "вызов", "тактиль", "эвакуац", "туалет", "доступн", "аутист", "логопед",
]


def probe(name: str, base: str) -> list[str]:
    out = [f"=== {name} ==="]
    for path in PATHS:
        url = base + path
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=35)
            html = resp.read().decode("utf-8", errors="replace")
            out.append(f"{url} -> {resp.status}, len={len(html)}")
            if any(k in html.lower() for k in ["dostup", "инвалид", "овз", "доступн"]):
                text = unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)))
                for kw in KEYWORDS:
                    if kw in text.lower():
                        idx = text.lower().find(kw)
                        out.append(f"  [{kw}] ...{text[max(0, idx - 60): idx + 220]}...")
        except Exception as exc:
            out.append(f"{url} ERR: {exc}")

    try:
        req = urllib.request.Request(base + "/", headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=35).read().decode("utf-8", errors="replace")
        links = sorted(set(re.findall(r'href=["\']([^"\']+)["\']', html, re.I)))
        out.append("Links:")
        for link in links:
            if any(k in link.lower() for k in ["sved", "dostup", "invalid", "ovz", "material", "objects", "mtl"]):
                out.append(f"  {link}")
    except Exception as exc:
        out.append(f"home ERR: {exc}")
    return out


lines = []
for n, b in SITES.items():
    lines.extend(probe(n, b))
    lines.append("")

from pathlib import Path
Path(__file__).resolve().parent.joinpath("probe_lgtu_ranepa_output.txt").write_text(
    "\n".join(lines), encoding="utf-8"
)
print("done")
