"""Download wikitext + categories of every main-namespace page of the Animash wiki."""
import json, urllib.parse, time, sys, subprocess
API = "https://the-unofficial-animash.fandom.com/api.php"
OUT = sys.argv[1]

def get(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(5):
        try:
            out = subprocess.run(["curl", "-sf", "-A", "AnimashFusionBrowser/1.0", url], capture_output=True, check=True).stdout
            return json.loads(out)
        except Exception as e:
            print("retry", e); time.sleep(2 + i * 2)
    raise SystemExit("failed")

pages, cont = {}, {}
while True:
    d = get({"action": "query", "generator": "allpages", "gapnamespace": 0, "gaplimit": 50,
             "gapfilterredir": "nonredirects", "prop": "revisions|categories", "rvprop": "content",
             "rvslots": "main", "cllimit": "max", **cont})
    for p in d["query"]["pages"]:
        e = pages.setdefault(p["title"], {"title": p["title"], "cats": []})
        if p.get("revisions"):
            e["wikitext"] = p["revisions"][0]["slots"]["main"]["content"]
        e["cats"] += [c["title"].split(":", 1)[1] for c in p.get("categories", [])]
    print(len(pages), end=" ", flush=True)
    if "continue" not in d: break
    cont = d["continue"]
json.dump(list(pages.values()), open(OUT, "w"), ensure_ascii=False)
print("\ndone", len(pages))
