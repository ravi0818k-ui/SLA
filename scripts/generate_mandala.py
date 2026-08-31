"""Generates Images/mandala.svg: an ornamental ring behind the host photo.
Run with: py -3 scripts/generate_mandala.py
"""
import math

CX, CY = 200, 200
COLORS = {
    "blue": "#1E5EFF",     # --smart-blue
    "orange": "#FF6B00",   # --memory-orange
    "gold": "#FFC107",     # --success-gold
    "deep": "#0B2A5B",     # --deep-learning-blue
}


def petal(cx, cy, r_inner, r_outer, angle_deg, width_deg, color, opacity):
    """A single almond/petal shape pointing outward from center."""
    a = math.radians(angle_deg)
    half = math.radians(width_deg / 2)
    x1 = cx + r_inner * math.cos(a - half)
    y1 = cy + r_inner * math.sin(a - half)
    x2 = cx + r_outer * math.cos(a)
    y2 = cy + r_outer * math.sin(a)
    x3 = cx + r_inner * math.cos(a + half)
    y3 = cy + r_inner * math.sin(a + half)
    return (
        f'<path d="M {x1:.1f} {y1:.1f} Q {x2:.1f} {y2:.1f} {x3:.1f} {y3:.1f}" '
        f'fill="none" stroke="{color}" stroke-width="2.2" stroke-linecap="round" opacity="{opacity}"/>'
    )


def dot_ring(cx, cy, r, count, radius, color, opacity):
    dots = []
    for i in range(count):
        a = math.radians(360 / count * i)
        x = cx + r * math.cos(a)
        y = cy + r * math.sin(a)
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{color}" opacity="{opacity}"/>')
    return "\n".join(dots)


def ring(cx, cy, r, color, width, opacity, dash=None):
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" '
        f'stroke-width="{width}" opacity="{opacity}"{dash_attr}/>'
    )


parts = []

# Outer dashed ring
parts.append(ring(CX, CY, 194, COLORS["blue"], 1.4, 0.35, dash="2 10"))

# Outer petal ring (12-fold)
petals_outer = [petal(CX, CY, 150, 190, i * 30, 14, COLORS["blue"] if i % 2 == 0 else COLORS["orange"], 0.45) for i in range(12)]
parts.extend(petals_outer)

# Mid solid ring
parts.append(ring(CX, CY, 148, COLORS["gold"], 1.2, 0.4))

# Mid petal ring (8-fold), offset rotation
petals_mid = [petal(CX, CY, 108, 144, i * 45 + 22.5, 18, COLORS["orange"], 0.5) for i in range(8)]
parts.extend(petals_mid)

# Dot accent ring
parts.append(dot_ring(CX, CY, 122, 24, 1.6, COLORS["deep"], 0.3))

# Inner ring
parts.append(ring(CX, CY, 104, COLORS["blue"], 1.2, 0.45))

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
{chr(10).join(parts)}
</svg>"""

with open("Images/mandala.svg", "w", encoding="utf-8") as f:
    f.write(svg)

print("wrote Images/mandala.svg", len(svg), "bytes")
