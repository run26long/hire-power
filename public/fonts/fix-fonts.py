from fontTools import ttLib
import os

fonts = [
    "EBGaramond-Regular.ttf",
    "EBGaramond-Bold.ttf",
    "EBGaramond-Italic.ttf",
    "EBGaramond-BoldItalic.ttf",
    "OpenSans-Regular.ttf",
    "OpenSans-Bold.ttf",
    "OpenSans-Italic.ttf",
    "OpenSans-BoldItalic.ttf",
    "SourceSerif4-Regular.ttf",
    "SourceSerif4-Bold.ttf",
    "SourceSerif4-Italic.ttf",
    "SourceSerif4-BoldItalic.ttf",
]

for filename in fonts:
    if not os.path.exists(filename):
        print(f"SKIP (not found): {filename}")
        continue
    font = ttLib.TTFont(filename)
    if 'GSUB' in font:
        del font['GSUB']
        print(f"{filename}: removed GSUB table")
    else:
        print(f"{filename}: no GSUB table found")
    font.save(filename)
    print(f"  Saved: {filename}")