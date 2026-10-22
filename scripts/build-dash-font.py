"""Build a language-independent full-width dash subset (fonttools + brotli).

Run: python scripts/build-dash-font.py
The unmodified OFL source is kept beside the generated asset.
"""
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
font = TTFont(root / "assets/fonts/noto-serif-jp-dashes.woff2", recalcTimestamp=False)
# Noto's Japanese locl substitutions turn em dashes into full-width bars.
# WebKit and Chromium differ in how they apply locl and ccmp to dash runs.
# Map both codepoints to the full-width glyph before shaping, preserving the
# original Unicode text and the font's continuous two/three-character ligatures.
for table in font["cmap"].tables:
    if table.isUnicode() and 0x2015 in table.cmap:
        table.cmap[0x2014] = table.cmap[0x2015]

names = {1: "Ari Novel Dash", 2: "Regular", 3: "Ari Novel Dash Regular 1.0",
         4: "Ari Novel Dash Regular", 6: "AriNovelDash-Regular",
         16: "Ari Novel Dash", 17: "Regular"}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.flavor = "woff2"
font.save(root / "assets/fonts/ari-novel-dashes.woff2")
