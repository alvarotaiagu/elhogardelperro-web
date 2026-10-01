"""Genera las marcas: Lontra (demo), Arxila y O Corzo (pruebas).

Uso: python build_marcas.py <carpeta marca/ de destino>
"""
import os
import sys
import xml.etree.ElementTree as ET

from geo import (P, circle, ellipse, rect, poly, union, inter, capsule, vesica,
                 close_, open_, mirror_x, to_d, ncontours)
from typo import text_path
from logo import tx, justified

DEST = sys.argv[1] if len(sys.argv) > 1 else "out_final"

# ------------------------------------------------------------------ util


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def write_svg(path, items, label, nd=2):
    """items: [(Path, fill, attrs)] ya colocados. Normaliza a (0,0) con la caja del primero
    si es isotipo (data-silueta) o de todo si es logo."""
    b = [it[0].bounds for it in items]
    x0 = min(v[0] for v in b)
    y0 = min(v[1] for v in b)
    x1 = max(v[2] for v in b)
    y1 = max(v[3] for v in b)
    body = "".join(
        f'<path{(" " + a) if a else ""} fill="{f}" d="{to_d(tx(p, -x0, -y0), nd)}"/>' for p, f, a in items)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(x1 - x0)} {fmt(y1 - y0)}" '
           f'role="img" aria-label="{label}">{body}</svg>\n')
    ET.fromstring(svg)  # XML bien formado
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(svg)
    return (x1 - x0, y1 - y0)


def mirror(p):
    return union(p, mirror_x(p, 50))


# ------------------------------------------------------------------ Lontra

BER, MAN = "#231B33", "#FF6A3D"
CREMA = "#F6F2EA"

LONTRA_HEAD = ("M 8 104 C 6 78 8 54 16 38 C 22 26 36 16 54 15 C 70 14 84 17 92 21 "
               "C 97 24 98 30 95 33 C 97 38 94 46 86 47 C 80 48 76 47 73 48 "
               "C 72 52 70 54 66 55 C 60 62 58 80 62 104 Z")


def lontra_iso():
    s = union(P(LONTRA_HEAD), circle(18, 27, 4.4))       # cabeza y cuello + oreja baja
    s = open_(close_(s, 2.5), 1)
    s = inter(s, rect(-10, -10, 120, 100))                # corte recto del busto
    eye = circle(66, 24, 3.4)
    nose = ellipse(93, 27, 4.6, 4, 15)
    whisk = union(*[circle(x, y, 1.6) for x, y in [(82, 37), (87.5, 39.5), (82, 42)]])
    dets = [inter(d, s) for d in (eye, nose, whisk)]
    return s, dets


# ------------------------------------------------------------------ O Corzo

BOS, LIQ = "#1F3A2E", "#B8CC5A"
CORZO_FACE = [(33, 42), (67, 42), (69, 56), (58, 95), (42, 95), (31, 56)]


def corzo_iso():
    w = 3.4
    face = open_(poly(CORZO_FACE), 4)
    ear = vesica(36, 50, 5, 26, 0.3)
    beam = capsule(43, 44, w + 1.3, 39.5, 14, w)          # cuerna corta y recta
    burr = circle(43, 41, w + 1.8)                         # roseta
    tine = capsule(40.8, 25, w, 31.5, 17.5, w * 0.9)       # punta trasera
    stub = capsule(41.8, 33, w * 0.95, 45.2, 28.5, w * 0.8)  # luchadera, corta: no cierra hueco
    s = close_(union(face, mirror(ear), mirror(union(beam, burr, tine, stub))), 1.6)
    inner = mirror(vesica(33, 48, 11, 30, 0.22))
    band = inter(rect(0, 78, 100, 84), face)               # banda clara del hocico
    eyes = mirror(vesica(35.5, 58, 43.5, 60, 0.27))
    dets = [inter(d, s) for d in (inner, eyes, band)]
    return s, dets


# ------------------------------------------------------------------ logos


def place(paths, target_h, x_right=None, x_left=None, cy=0):
    x0, y0, x1, y1 = paths[0].bounds
    k = target_h / (y1 - y0)
    out = [p.transform(k, 0, 0, k, 0, 0) for p in paths]
    x0, y0, x1, y1 = out[0].bounds
    dx = (x_right - x1) if x_right is not None else (x_left - x0)
    dy = cy - (y0 + y1) / 2
    return [tx(p, dx, dy) for p in out]


def lontra_logo():
    word, _, met = text_path("YoungSerif-Regular.ttf", "Lontra", 100)
    wx0, wy0, wx1, wy1 = word.bounds
    sub, trk = justified("Rubik[wght].ttf", "CLÍNICA VETERINARIA", 18.5, wx1 - wx0, {"wght": 500}, 0.35)
    sx0, sy0, sx1, sy1 = sub.bounds
    sub = tx(sub, wx0 - sx0, wy1 + 21 - sy0)
    top, bot = wy0, sub.bounds[3]
    th = bot - top
    sil, dets = lontra_iso()
    iso = place([sil] + dets, th * 1.1, x_right=wx0 - 0.36 * th, cy=(top + bot) / 2)
    items = [(iso[0], MAN, "")] + [(d, BER, "") for d in iso[1:]] + [(word, BER, ""), (sub, BER, "")]
    neg = [(iso[0], MAN, "")] + [(d, BER, "") for d in iso[1:]] + [(word, CREMA, ""), (sub, CREMA, "")]
    return items, trk, neg


def arxila_logo():
    ARX = "#B83A2B"
    GRI = "#2B2522"
    word, _, met = text_path("Archivo[wdth,wght].ttf", "ARXILA", 100, {"wdth": 125, "wght": 700}, 0.02)
    wx0, wy0, wx1, wy1 = word.bounds
    sub, _, smet = text_path("Archivo[wdth,wght].ttf", "veterinaria", 33, {"wdth": 125, "wght": 400}, 0.05)
    sx0, sy0, sx1, sy1 = sub.bounds
    # "veterinaria" alineada a la derecha de la tinta; su altura x empieza 20 u bajo ARXILA
    sub = tx(sub, wx1 - sx1, wy1 + 20 + smet["xh"])
    # regla fina a la izquierda de "veterinaria", en la linea x de la palabra
    sb = sub.bounds
    xh_mid = (sb[1] + sb[3]) / 2
    rule = rect(wx0, xh_mid - 1.6, sb[0] - 16, xh_mid + 1.6)
    items = [(word, ARX, ""), (rule, ARX, ""), (sub, GRI, "")]
    neg = [(word, "#F4EDE8", ""), (rule, ARX, ""), (sub, "#F4EDE8", "")]
    return items, neg


def corzo_logo():
    word, _, met = text_path("Jost[wght].ttf", "O Corzo", 100, {"wght": 500}, 0.0)
    wx0, wy0, wx1, wy1 = word.bounds
    cap = wy1 - wy0
    sub, _, _ = text_path("Jost[wght].ttf", "VETERINARIA", 22, {"wght": 500}, 0.26)
    sx0, sy0, sx1, sy1 = sub.bounds
    gap = 30
    rule_x = wx1 + gap
    sub = tx(sub, rule_x + 3 + gap - sx0, (wy0 + wy1) / 2 - (sy0 + sy1) / 2)
    rule = rect(rule_x, wy0 + cap * 0.08, rule_x + 3, wy1 - cap * 0.08)
    sil, dets = corzo_iso()
    iso = place([sil] + dets, cap * 1.72, x_right=wx0 - 0.40 * cap, cy=(wy0 + wy1) / 2 - cap * 0.03)
    items = [(iso[0], BOS, "")] + [(d, LIQ, "") for d in iso[1:]] + [
        (word, BOS, ""), (rule, BOS, ""), (sub, BOS, "")]
    neg = [(iso[0], LIQ, "")] + [(d, BOS, "") for d in iso[1:]] + [
        (word, "#EEF2E3", ""), (rule, LIQ, ""), (sub, "#EEF2E3", "")]
    return items, neg


if __name__ == "__main__":
    NEG = sys.argv[2] if len(sys.argv) > 2 else os.path.join(DEST, "_neg")
    s, d = lontra_iso()
    wh = write_svg(os.path.join(DEST, "isotipo.svg"),
                   [(s, MAN, 'data-silueta=""')] + [(x, BER, "") for x in d], "Lontra")
    print("lontra iso", [round(v, 2) for v in wh], "w/h", round(wh[0] / wh[1], 3), "contornos", ncontours(s))
    items, trk, neg = lontra_logo()
    wh = write_svg(os.path.join(DEST, "logo.svg"), items, "Lontra · Clínica Veterinaria", 1)
    write_svg(os.path.join(NEG, "lontra-logo.svg"), neg, "Lontra · Clínica Veterinaria")
    print("lontra logo", [round(v, 1) for v in wh], "tracking sub", round(trk, 3))

    items, neg = arxila_logo()
    wh = write_svg(os.path.join(DEST, "pruebas", "arxila", "logo.svg"), items, "Arxila veterinaria", 1)
    write_svg(os.path.join(NEG, "arxila-logo.svg"), neg, "Arxila veterinaria")
    print("arxila logo", [round(v, 1) for v in wh])

    s, d = corzo_iso()
    wh = write_svg(os.path.join(DEST, "pruebas", "corzo", "isotipo.svg"),
                   [(s, BOS, 'data-silueta=""')] + [(x, LIQ, "") for x in d], "O Corzo")
    write_svg(os.path.join(NEG, "corzo-isotipo.svg"),
              [(s, LIQ, 'data-silueta=""')] + [(x, BOS, "") for x in d], "O Corzo")
    print("corzo iso", [round(v, 2) for v in wh], "w/h", round(wh[0] / wh[1], 3), "contornos", ncontours(s))
    items, neg = corzo_logo()
    wh = write_svg(os.path.join(DEST, "pruebas", "corzo", "logo.svg"), items, "O Corzo veterinaria", 1)
    write_svg(os.path.join(NEG, "corzo-logo.svg"), neg, "O Corzo veterinaria")
    print("corzo logo", [round(v, 1) for v in wh])
