"""Turn the scraped wiki pages into site/data.js for the fusion browser.

usage: python3 -I scripts/build_data.py raw/pages.json raw/images.json site/data.js
"""
import json, re, sys
from collections import defaultdict

pages_path, images_path, out_path = sys.argv[1:4]
PAGES = {p["title"]: p for p in json.load(open(pages_path))}
IMAGES = json.load(open(images_path))
IMAGES_CI = {k.lower().replace("_", " "): v for k, v in IMAGES.items()}

RARITY = {"common": 3, "unique": 4, "rare": 5, "ultra rare": 6, "legendary": 7, "mythical": 8,
          "divine": 9, "supreme": 10, "alpha supreme": 11, "gamma supreme": 12, "zeta supreme": 13,
          "theta supreme": 14, "kappa supreme": 15}
RARITY_NAME = {v: k.title() for k, v in RARITY.items()}
GRADE_KEYS = ["Strength", "Speed", "Intelligence", "Utility", "Value", "Convenience", "Beauty", "Mystical"]
ARENA_KEYS = ["Vitality", "Attack", "Defense", "Accuracy", "Dodge", "Luck"]
GRADE_RE = r"(S\+*|[A-F][+-]*\+?)"


def image_url(name):
    if not name:
        return None
    name = re.sub(r"^(File|Image):", "", name.strip(), flags=re.I).strip()
    return IMAGES.get(name) or IMAGES_CI.get(name.lower().replace("_", " "))


def clean(text):
    """Strip wiki markup down to plain text."""
    t = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    t = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", t, flags=re.I)
    t = re.sub(r"\[\[Category:[^\]]*\]\]", "", t)
    t = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", t)
    t = re.sub(r"\{\{[^{}]*\}\}", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("'''", "").replace("''", "")
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n{2,}", "\n", t).strip()


def infobox(text):
    """Parameters of the first ANIMASH / FusionLiving / FusionObject infobox."""
    m = re.search(r"\{\{\s*(ANIMASH|Animash|FusionLiving|FusionObject)\s*\|", text)
    if not m:
        return {}
    depth, i = 2, m.end()
    while i < len(text) and depth:
        if text.startswith("{{", i): depth += 2; i += 2; continue
        if text.startswith("}}", i): depth -= 2; i += 2; continue
        i += 1
    body = text[m.end():i - 2]
    body = re.sub(r"<gallery[^>]*>(.*?)</gallery>",
                  lambda g: g.group(1).strip().splitlines()[0].split("|")[0] if g.group(1).strip() else "", body, flags=re.S)
    params = {}
    for part in re.split(r"\|(?![^\[]*\]\])", body):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip().lower()] = v.strip()
    return params


def sections(text):
    """[(heading, body)] in page order; headings stripped of bold markup and colons."""
    out, cur, buf = [], "_lead", []
    for line in text.splitlines():
        m = re.match(r"^(={2,6})\s*(.*?)\s*\1\s*$", line)
        if m:
            out.append((cur, "\n".join(buf)))
            cur, buf = m.group(2).replace("'''", "").strip(), []
        else:
            buf.append(line)
    out.append((cur, "\n".join(buf)))
    return out


def named_items(body):
    """Parse '* '''Name:''' ''desc''' style lines (bulleted or not)."""
    items = []
    for m in re.finditer(r"'''\s*([^'\n]+?)\s*:?\s*'''\s*:?\s*(.*)", body):
        name = clean(m.group(1)).rstrip(":").strip()
        desc = clean(m.group(2))
        if name:
            items.append({"name": name, "desc": desc})
    if not items:
        for line in body.splitlines():
            line = clean(line.lstrip("*# "))
            if line and ":" in line[:60]:
                n, d = line.split(":", 1)
                items.append({"name": n.strip(), "desc": d.strip()})
    return items


def stars_from(s):
    if not s:
        return None
    m = re.search(r"\((\d+)\)", s)
    if m:
        return int(m.group(1))
    s = clean(s).lower()
    for name in sorted(RARITY, key=len, reverse=True):
        if name in s:
            return RARITY[name]
    return None


# ---------- base animals (Animals page table) ----------
def table_rows(text):
    rows = []
    for chunk in re.split(r"\n\|-", text):
        cells = [c.strip() for c in re.findall(r"^\|(?!\+|-|\})(.*)$", chunk, re.M)]
        cells = [x for c in cells for x in re.split(r"\s*\|\|\s*", c)]
        if cells:
            rows.append(cells)
    return rows


def link_target(cell):
    m = re.search(r"\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]", cell)
    return (m.group(1) if m else clean(cell)).strip()


def file_in(cell):
    m = re.search(r"\[\[(?:File|Image):([^|\]]+)", cell, re.I)
    return m.group(1).strip() if m else None


bases = {}
for cells in table_rows(PAGES["Animals"]["wikitext"]):
    if len(cells) >= 4 and "[[" in cells[0]:
        name = link_target(cells[0])
        bases[name] = {"name": name, "image": image_url(file_in(cells[1])), "class": clean(cells[2]),
                       "status": clean(cells[3])}
BASE_CI = {k.lower(): k for k in bases}
BASE_CI.update({k.lower().replace(" ", ""): k for k in bases})


def base_name(s):
    s = clean(s).strip().lower()
    return BASE_CI.get(s) or BASE_CI.get(s.replace(" ", "")) or BASE_CI.get(s.rstrip("s"))


# ---------- combination tables on each base animal page ----------
pairs = {}  # fusion name (lower) -> info from base tables
for b in bases:
    page = PAGES.get(b)
    if not page:
        continue
    for cells in table_rows(page["wikitext"]):
        if len(cells) < 3 or "[[" not in cells[1]:
            continue
        other = base_name(link_target(cells[0])) if "none" not in cells[0].lower() else None
        fname = link_target(cells[1])
        if not other or not fname or fname.lower() == b.lower():
            continue
        e = pairs.setdefault(fname.lower(), {"name": fname, "parents": set()})
        e["parents"].update([b, other])
        e.setdefault("icon", file_in(cells[2]) if len(cells) > 2 else None)
        if len(cells) > 3 and stars_from(cells[3]):
            e.setdefault("stars", stars_from(cells[3]))


# ---------- fusion pages ----------
def parse_fusion(page):
    text, cats = page["wikitext"], list(dict.fromkeys(page["cats"]))
    ib = infobox(text)
    secs = sections(text)
    name = page["title"]
    rec = {"name": name, "url": "https://the-unofficial-animash.fandom.com/wiki/" + name.replace(" ", "_")}

    # parents
    parents = []
    raw = ib.get("parents") or ib.get("fusion") or ""
    if not raw:
        m = re.search(r"<\s*(\[\[[^\]]+\]\])\s*[-+x&]\s*(\[\[[^\]]+\]\])\s*>", text)
        if m:
            raw = m.group(1) + " + " + m.group(2)
    for part in re.split(r"\s*(?:\+|&|\bx\b|,|\band\b)\s*", clean(raw), flags=re.I):
        b = base_name(part)
        if b and b not in parents:
            parents.append(b)
    pinfo = pairs.get(name.lower())
    if pinfo and len(pinfo["parents"]) >= len(parents):
        parents = sorted(pinfo["parents"]) if len(pinfo["parents"]) == 2 or not parents else parents
    if len(parents) < 2:
        from_cats = [base_name(c) for c in cats if base_name(c)]
        for b in from_cats:
            if b not in parents:
                parents.append(b)
    if len(parents) == 1:
        parents = parents * 2  # same-animal fusion
    rec["parents"] = parents[:2]

    # stars / rarity
    stars = stars_from(ib.get("stars") or ib.get("star_rank"))
    if stars is None and pinfo:
        stars = pinfo.get("stars")
    if stars is None:
        for c in cats:
            if c.lower() in RARITY:
                stars = RARITY[c.lower()]
    rec["stars"] = stars
    rec["rarity"] = RARITY_NAME.get(stars)

    # image
    img = image_url(ib.get("image1"))
    if not img and pinfo:
        img = image_url(pinfo.get("icon"))
    if not img:
        for m in re.finditer(r"\[\[(?:File|Image):([^|\]]+)", text, re.I):
            img = image_url(m.group(1))
            if img: break
    if not img:
        for g in re.findall(r"<gallery[^>]*>(.*?)</gallery>", text, re.S):
            for line in g.splitlines():
                img = image_url(line.split("|")[0])
                if img: break
    rec["image"] = img
    rec["type"] = "Object" if "Objects" in cats or "Object" in cats or ib.get("utility") or "FusionObject" in text[:40] else "Living"

    # letter-grade stats
    grades = {}
    for k in GRADE_KEYS:
        v = ib.get(k.lower())
        if not v or not re.fullmatch(GRADE_RE, v):
            m = re.search(r"'''\s*" + k + r"\s*:?\s*'''\s*:?\s*" + GRADE_RE + r"(?![\w])", text) or \
                re.search(r"=+\s*'*\s*" + k + r"\s*:?\s*'*\s*" + GRADE_RE + r"\s*=+", text)
            v = m.group(1) if m else None
        if not v:
            for c in cats:
                m = re.fullmatch(k + r" " + GRADE_RE, c)
                if m: v = m.group(1)
        if v:
            grades[k] = v
    rec["grades"] = grades

    # arena stats
    arena = {}
    for k in ARENA_KEYS:
        v = None
        for c in cats:
            m = re.fullmatch(k + r": (\d+)", c)
            if m: v = int(m.group(1))
        if v is None:
            m = re.search(r"'''\s*" + k + r"\s*:?\s*'''\s*:?\s*(\d+)", text)
            v = int(m.group(1)) if m else None
        if v is not None:
            arena[k] = v
    rec["arena"] = arena

    # text sections
    desc, lore_ability, arena_special, ultra, moves, extra = "", None, [], [], [], {}
    seen_arena = False
    for head, body in secs:
        h = head.lower().rstrip(":").strip()
        if "arena" in h and "stat" in h:
            seen_arena = True
        if h == "description":
            desc = clean(body)
        elif h == "_lead" and not desc:
            desc = clean(re.sub(r"^.*?<\s*\[\[.*?\]\]\s*>'*", "", body, flags=re.S))
        elif h == "special ability":
            items = named_items(body)
            if not seen_arena and lore_ability is None:
                lore_ability = items[0] if items else None
            else:
                arena_special += items
        elif h == "arena moves":
            moves += named_items(body)
        elif h == "ultra ability":
            ultra += named_items(body)
        elif h in ("location", "average lifespan", "temperament", "preferred food", "commonly used for"):
            v = clean(body)
            if v: extra[head.rstrip(":")] = v
    if lore_ability is None and ib.get("special_ability"):
        lore_ability = {"name": clean(ib["special_ability"]), "desc": ""}
    rec["description"] = desc[:900]
    rec["ability"] = lore_ability
    rec["arenaSpecial"] = arena_special[:2]
    rec["moves"] = moves[:4]
    rec["ultra"] = ultra[:2]
    rec["info"] = extra
    return rec


fusions = []
seen = set()
for title, page in PAGES.items():
    cats = page["cats"]
    is_fusion = "Fusions" in cats or title.lower() in pairs or re.search(r"\{\{\s*(FusionLiving|FusionObject)", page["wikitext"])
    if not is_fusion or title in bases or "Candidates for deletion" in cats:
        continue
    r = parse_fusion(page)
    if len(r["parents"]) < 2:
        continue
    fusions.append(r)
    seen.add(title.lower())

# fusions listed on base tables but without their own page
known_pairs = {tuple(sorted(r["parents"])) for r in fusions}
for key, p in pairs.items():
    if key in seen or p["name"] in bases or tuple(sorted(p["parents"])) in known_pairs:
        continue
    stars = p.get("stars")
    fusions.append({"name": p["name"], "url": None, "parents": sorted(p["parents"]), "stars": stars,
                    "rarity": RARITY_NAME.get(stars), "image": image_url(p.get("icon")), "type": "Living",
                    "grades": {}, "arena": {}, "description": "", "ability": None, "arenaSpecial": [],
                    "moves": [], "ultra": [], "info": {}, "stub": True})

fusions.sort(key=lambda r: r["name"].lower())

# ---------- animal sets (pools the game rotates every 60 minutes) ----------
sets, unmatched = [], set()
for m in re.finditer(r"^==\s*(Set\s*\d+)\s*(\(Upcoming\))?\s*==\s*$(.*?)(?=^==[^=]|\Z)",
                     PAGES["Animal Sets"]["wikitext"], re.S | re.M):
    animals = []
    for line in re.findall(r"^#\s*(.+?)\s*$", m.group(3), re.M):
        b = base_name(re.sub(r"\(.*?\)", "", line))
        if b and b not in animals:
            animals.append(b)
        elif not b:
            unmatched.add(line)
    sets.append({"name": m.group(1), "upcoming": bool(m.group(2)), "animals": animals})
PERMANENT = [b for b in ["Black Hole", "Dragon", "Plasma", "Unicorn"] if b in bases]

data = {"source": "https://the-unofficial-animash.fandom.com/wiki/The_Unofficial_Animash_Wiki",
        "bases": sorted(bases.values(), key=lambda b: b["name"].lower()), "fusions": fusions,
        "sets": sets, "permanent": PERMANENT}
with open(out_path, "w") as f:
    f.write("window.ANIMASH = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

n = len(fusions)
print(f"bases {len(bases)}  fusions {n}")
for k in ["image", "stars", "ability"]:
    print(k, sum(1 for r in fusions if r.get(k)), "/", n)
print("arena", sum(1 for r in fusions if len(r["arena"]) == 6), "grades", sum(1 for r in fusions if r["grades"]),
      "moves", sum(1 for r in fusions if r["moves"]), "ultra", sum(1 for r in fusions if r["ultra"]))
print("sets", len(sets), [len(s["animals"]) for s in sets], "unmatched", sorted(unmatched))
