"""Phone app icons from assets/icon-ios.svg and assets/icon-android-foreground.svg.

`tauri icon` makes every icon from the Mac-style icon (a rounded tile with a margin), which looks shrunken on
phones: iOS masks a full-bleed square itself, and Android wants an adaptive icon. Run after `tauri icon`
(`npm run icons` does both). Needs rsvg-convert (brew install librsvg) and Pillow.
"""
import io
import subprocess
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
tauri = root / "src-tauri"


def render(svg: str, size: int = 1024) -> Image.Image:
    png = subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(root / "assets" / svg)], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGBA")


# iPhone: every size in the asset catalogue, opaque (the App Store refuses icons with an alpha channel).
ios = render("icon-ios.svg").convert("RGB")
for folder in [tauri / "gen/apple/Assets.xcassets/AppIcon.appiconset", tauri / "icons/ios"]:
    for f in folder.glob("*.png"):
        w = Image.open(f).size[0]
        ios.resize((w, w), Image.LANCZOS).save(f)

# Android: adaptive icon (white background + foreground, also used for themed icons) and legacy fallbacks.
fg = render("icon-android-foreground.svg")
legacy_square = ios.copy()
mask = Image.new("L", (1024, 1024), 0)
from PIL import ImageDraw

ImageDraw.Draw(mask).ellipse((0, 0, 1023, 1023), fill=255)
legacy_round = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
legacy_round.paste(ios, (0, 0), mask)
square_mask = Image.new("L", (1024, 1024), 0)
ImageDraw.Draw(square_mask).rounded_rectangle((0, 0, 1023, 1023), radius=180, fill=255)
legacy = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
legacy.paste(legacy_square, (0, 0), square_mask)

densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for res in [tauri / "gen/android/app/src/main/res", tauri / "icons/android"]:
    if not res.exists():
        continue
    for name, k in densities.items():
        d = res / f"mipmap-{name}"
        d.mkdir(exist_ok=True)
        legacy.resize((round(48 * k),) * 2, Image.LANCZOS).save(d / "ic_launcher.png")
        legacy_round.resize((round(48 * k),) * 2, Image.LANCZOS).save(d / "ic_launcher_round.png")
        fg.resize((round(108 * k),) * 2, Image.LANCZOS).save(d / "ic_launcher_foreground.png")
    anydpi = res / "mipmap-anydpi-v26"
    anydpi.mkdir(exist_ok=True)
    xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/midore_icon_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
    for n in ["ic_launcher.xml", "ic_launcher_round.xml"]:
        (anydpi / n).write_text(xml)
    values = res / "values"
    values.mkdir(exist_ok=True)
    (values / "midore_icon.xml").write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="midore_icon_background">#FFFFFF</color>\n</resources>\n')
    # Tauri's default vector foreground would otherwise win on API 24-25 devices that look for drawables first.
    old = res / "drawable-v24" / "ic_launcher_foreground.xml"
    if old.exists():
        old.unlink()
print("phone icons written")
