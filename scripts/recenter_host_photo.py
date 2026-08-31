"""Recenters the host photo horizontally within its transparent canvas.

Images/Your host.png has a transparent (alpha-cutout) background, but the
person isn't centered in the frame - the alpha-channel silhouette sits
noticeably left of canvas center. This detects the silhouette's bounding
box from the alpha channel and shifts the whole RGBA image horizontally so
the subject is centered, then re-exports the 840x840 WebP used on the page.

Run with: py -3 scripts/recenter_host_photo.py
"""
from PIL import Image

SRC_PNG = "Images/Your host.png"
OUT_WEBP = "Images/Your host.webp"
ALPHA_THRESHOLD = 10


def alpha_bbox(im):
    alpha = im.split()[3]
    return alpha.point(lambda a: 255 if a > ALPHA_THRESHOLD else 0).getbbox()


def main():
    im = Image.open(SRC_PNG).convert("RGBA")
    w, h = im.size

    minx, miny, maxx, maxy = alpha_bbox(im)
    subject_center_x = (minx + maxx) / 2
    canvas_center_x = w / 2
    shift_x = round(canvas_center_x - subject_center_x)

    print(f"canvas: {w}x{h}")
    print(f"silhouette bbox: {(minx, miny, maxx, maxy)}")
    print(f"subject center x: {subject_center_x:.1f} (canvas center: {canvas_center_x})")
    print(f"horizontal shift needed: {shift_x:+d}px")

    recentered = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    recentered.paste(im, (shift_x, 0), im)

    new_minx, new_miny, new_maxx, new_maxy = alpha_bbox(recentered)
    new_center_x = (new_minx + new_maxx) / 2
    print(f"new subject center x: {new_center_x:.1f} (offset from canvas center: {new_center_x - canvas_center_x:+.1f}px)")

    recentered.save(SRC_PNG, "PNG")
    print(f"wrote {SRC_PNG}")

    webp = recentered.resize((840, 840), Image.LANCZOS)
    webp.save(OUT_WEBP, "WEBP", quality=80)
    print(f"wrote {OUT_WEBP}")


if __name__ == "__main__":
    main()
