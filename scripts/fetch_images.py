"""Resolve image URLs: page lead images + every File: referenced in wikitext."""
import json, re, sys, subprocess, urllib.parse, time
API = "https://the-unofficial-animash.fandom.com/api.php"
pages = json.load(open(sys.argv[1]))

def get(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    for i in range(5):
        try:
            return json.loads(subprocess.run(["curl", "-sf", "-A", "AnimashFusionBrowser/1.0", url],
                                             capture_output=True, check=True).stdout)
        except Exception as e:
            print("retry", e); time.sleep(2 + 2 * i)
    raise SystemExit("failed")

files = set()
for p in pages:
    t = p["wikitext"]
    for m in re.finditer(r"(?:File:|image1\s*=\s*)([^|\]\n}<]+?\.(?:png|jpe?g|gif|webp))", t, re.I):
        files.add(m.group(1).strip())
    for m in re.finditer(r"<gallery[^>]*>(.*?)</gallery>", t, re.S):
        for line in m.group(1).splitlines():
            f = line.split("|")[0].strip()
            if f: files.add(re.sub(r"^(File|Image):", "", f).strip())
files = sorted(f for f in files if f)
print(len(files), "files")
out = {}
for i in range(0, len(files), 50):
    chunk = files[i:i + 50]
    d = get({"action": "query", "titles": "|".join("File:" + f for f in chunk), "prop": "imageinfo", "iiprop": "url"})
    norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
    for p in d["query"]["pages"]:
        if p.get("imageinfo"):
            src = norm.get(p["title"], p["title"])
            out[src.split(":", 1)[1]] = p["imageinfo"][0]["url"]
            out[p["title"].split(":", 1)[1]] = p["imageinfo"][0]["url"]
    print(i, end=" ", flush=True)
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
print("\nresolved", len(out))
