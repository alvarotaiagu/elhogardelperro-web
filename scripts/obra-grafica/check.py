"""Comprueba las reglas duras de los SVG entregados."""
import os
import re
import sys
import xml.etree.ElementTree as ET

import geo  # noqa
import pathops
from fontTools.svgLib.path import parse_path

P = sys.argv[1]
NS = "{http://www.w3.org/2000/svg}"
fails = []


def ok(cond, msg):
    if not cond:
        fails.append(msg)


def path_of(d):
    p = pathops.Path()
    parse_path(d, p.getPen())
    return p


def common(f, root, raw):
    ok(root.tag == NS + "svg", f + ": raíz no es svg")
    ok("viewBox" in root.attrib, f + ": sin viewBox")
    ok("width" not in root.attrib and "height" not in root.attrib, f + ": width/height fijos")
    ok(not re.search(r"<style|class=|\sid=|transform=|<text|stroke|metadata|inkscape|sodipodi", raw),
       f + ": style/class/id/transform/text/stroke/metadatos")
    vb = [float(v) for v in root.attrib["viewBox"].split()]
    ok(vb[0] == 0 and vb[1] == 0, f + ": viewBox no empieza en 0 0")
    return vb


# especies
for k in ["perro", "gato", "conejo", "huron", "ave", "reptil", "roedor"]:
    f = os.path.join(P, "ilustracion", "especies", k + ".svg")
    raw = open(f, encoding="utf-8").read()
    root = ET.fromstring(raw)
    vb = common(f, root, raw)
    ok(vb == [0, 0, 120, 120], f + ": viewBox distinto de 0 0 120 120")
    paths = root.findall(NS + "path")
    ok(len(paths) == 1 and len(list(root)) == 1, f + ": más de un elemento")
    ok(paths[0].get("fill") == "currentColor", f + ": fill no es currentColor")
    b = path_of(paths[0].get("d")).bounds
    ok(abs(b[3] - 108) < 0.05, f + f": no apoya en y=108 ({b[3]:.2f})")
    ok(b[0] >= 2 and b[2] <= 118 and b[1] >= 2, f + f": se sale del margen {b}")
    print(f"{k:7s} alto {108 - b[1]:5.1f} ({(108 - b[1]) / 108 * 100:4.1f} %)  x {b[0]:.1f}-{b[2]:.1f}")

# isotipos
for f in ["marca/isotipo.svg", "marca/pruebas/corzo/isotipo.svg"]:
    fp = os.path.join(P, f)
    raw = open(fp, encoding="utf-8").read()
    root = ET.fromstring(raw)
    vb = common(f, root, raw)
    kids = list(root)
    ok(kids[0].tag == NS + "path" and "data-silueta" in kids[0].attrib, f + ": el primer hijo no es path data-silueta")
    d = kids[0].get("d")
    ok(len(re.findall(r"[Mm]", d)) == 1, f + ": la silueta tiene más de un subtrazado (agujeros o islas)")
    sp = path_of(d)
    x0, y0, x1, y1 = sp.bounds
    r = (x1 - x0) / (y1 - y0)
    ok(0.8 <= r <= 1.25, f + f": proporción {r:.3f}")
    ok(abs(x0) < 0.02 and abs(y0) < 0.02 and abs(x1 - vb[2]) < 0.02 and abs(y1 - vb[3]) < 0.02,
       f + ": viewBox no ajustado a la silueta")
    for k2 in kids:
        ok(re.fullmatch(r"#[0-9A-F]{6}", k2.get("fill", "")) is not None, f + ": fill no es #hex")
    fills = [k2.get("fill") for k2 in kids]
    print(f"{f}: {len(kids)} paths, proporción {r:.3f}, colores {sorted(set(fills))}")

# logos
for f in ["marca/logo.svg", "marca/pruebas/arxila/logo.svg", "marca/pruebas/corzo/logo.svg"]:
    fp = os.path.join(P, f)
    raw = open(fp, encoding="utf-8").read()
    root = ET.fromstring(raw)
    vb = common(f, root, raw)
    fills = sorted(set(k.get("fill") for k in root))
    print(f"{f}: viewBox {vb[2]:.1f}x{vb[3]:.1f}, {len(list(root))} paths, colores {fills}, {len(raw)} bytes")

print("\nFALLOS:" if fails else "\nTodo en regla.")
for x in fails:
    print(" -", x)
