#!/bin/sh
# Re-scrape the Animash wiki and rebuild site/data.js
set -e
cd "$(dirname "$0")/.."
mkdir -p raw
python3 -I scripts/fetch.py raw/pages.json
python3 -I scripts/fetch_images.py raw/pages.json raw/images.json
python3 -I scripts/build_data.py raw/pages.json raw/images.json site/data.js
