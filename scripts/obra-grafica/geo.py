"""Geometria constructiva para las siluetas y marcas.

Primitivas (circulos, elipses, capsulas tangentes, trazos con grosor
variable) + booleanas de skia-pathops + redondeo morfologico uniforme
(cerrar = empalme de esquinas concavas, abrir = redondeo de convexas).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "pylib"))

import pathops  # noqa: E402
from fontTools.svgLib.path import parse_path  # noqa: E402
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402

K = 0.5522847498


def P(d):
    """SVG path d -> pathops.Path"""
    p = pathops.Path()
    parse_path(d, p.getPen())
    return p


def circle(cx, cy, r):
    p = pathops.Path()
    k = K * r
    p.moveTo(cx + r, cy)
    p.cubicTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    p.cubicTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    p.cubicTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    p.cubicTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    p.close()
    return p


def ellipse(cx, cy, rx, ry, rot=0.0):
    p = circle(0, 0, 1)
    a = math.radians(rot)
    c, s = math.cos(a), math.sin(a)
    # escala y luego rota y traslada
    return p.transform(rx * c, rx * s, -ry * s, ry * c, cx, cy)


def rect(x0, y0, x1, y1):
    p = pathops.Path()
    p.moveTo(x0, y0)
    p.lineTo(x1, y0)
    p.lineTo(x1, y1)
    p.lineTo(x0, y1)
    p.close()
    return p


def poly(pts):
    p = pathops.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.close()
    return p


def union(*ps):
    ps = [p for p in ps if p is not None]
    out = pathops.Path()
    for p in ps:
        out = pathops.op(out, p, pathops.PathOp.UNION)
    return out


def diff(a, *bs):
    out = a
    for b in bs:
        out = pathops.op(out, b, pathops.PathOp.DIFFERENCE)
    return out


def inter(a, b):
    return pathops.op(a, b, pathops.PathOp.INTERSECTION)


def capsule(x1, y1, r1, x2, y2, r2):
    """Envolvente tangente de dos circulos (hueso / capsula conica)."""
    dx, dy = x2 - x1, y2 - y1
    d = math.hypot(dx, dy)
    parts = [circle(x1, y1, r1), circle(x2, y2, r2)]
    if d > abs(r1 - r2) + 1e-6:
        th = math.atan2(dy, dx)
        al = math.acos((r1 - r2) / d)
        pts = [
            (x1 + r1 * math.cos(th + al), y1 + r1 * math.sin(th + al)),
            (x2 + r2 * math.cos(th + al), y2 + r2 * math.sin(th + al)),
            (x2 + r2 * math.cos(th - al), y2 + r2 * math.sin(th - al)),
            (x1 + r1 * math.cos(th - al), y1 + r1 * math.sin(th - al)),
        ]
        parts.append(poly(pts))
    return union(*parts)


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(
        u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
        for a, b, c, d in zip(p0, p1, p2, p3)
    )


def brush(p0, p1, p2, p3, r0, r1, n=24, ease=1.0):
    """Trazo de grosor variable a lo largo de una cubica (cadena de capsulas)."""
    pts = [bez(p0, p1, p2, p3, i / n) for i in range(n + 1)]
    rs = [r0 + (r1 - r0) * ((i / n) ** ease) for i in range(n + 1)]
    out = pathops.Path()
    for i in range(n):
        out = union(out, capsule(pts[i][0], pts[i][1], rs[i], pts[i + 1][0], pts[i + 1][1], rs[i + 1]))
    return out


def stroke(path, width, cap="round"):
    p = pathops.Path()
    p.addPath(path)
    caps = {"round": pathops.LineCap.ROUND_CAP, "butt": pathops.LineCap.BUTT_CAP}
    p.stroke(width, caps[cap], pathops.LineJoin.ROUND_JOIN, 4)
    p.convertConicsToQuads()
    p.simplify()
    return p


def line_cut(d, width):
    """Trazo abierto (d de SVG) convertido en forma, para cortes."""
    return stroke(P(d), width)


def dilate(path, r):
    return union(path, stroke(path, 2 * r))


def erode(path, r):
    return diff(path, stroke(path, 2 * r))


def close_(path, r):
    """Empalma las esquinas concavas con radio r."""
    return erode(dilate(path, r), r)


def open_(path, r):
    """Redondea las esquinas convexas con radio r."""
    return dilate(erode(path, r), r)


def fmt(v, nd):
    s = f"{v:.{nd}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s in ("-0", ""):
        s = "0"
    return s


def to_d(path, nd=2):
    p = pathops.Path()
    p.addPath(path)
    p.convertConicsToQuads()
    pen = SVGPathPen(None, ntos=lambda v: fmt(v, nd))
    p.draw(pen)
    return pen.getCommands()


def bounds(path):
    return path.bounds


def area(path):
    return abs(path.area)


def ncontours(path):
    return len(list(path.contours))


def translate(path, dx, dy):
    return path.transform(1, 0, 0, 1, dx, dy)


def scale(path, s, cx=0, cy=0):
    return path.transform(s, 0, 0, s, cx - s * cx, cy - s * cy)


def rotate(path, deg, cx=0, cy=0):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return path.transform(c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy)


def mirror_x(path, cx):
    return path.transform(-1, 0, 0, 1, 2 * cx, 0)


def squircle(cx, cy, rx, ry, k=0.66):
    """Superelipse aproximada: 4 cubicas con asa larga (k=0.5523 = elipse)."""
    p = pathops.Path()
    p.moveTo(cx + rx, cy)
    p.cubicTo(cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry)
    p.cubicTo(cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy)
    p.cubicTo(cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry)
    p.cubicTo(cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy)
    p.close()
    return p


def svg_doc(vb, paths, extra=""):
    """paths: lista de (d, fill, attrs)"""
    x0, y0, w, h = vb
    body = "".join(f'<path{(" " + a) if a else ""} fill="{f}" d="{d}"/>' for d, f, a in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(x0,2)} {fmt(y0,2)} {fmt(w,2)} {fmt(h,2)}"{extra}>'
            f'{body}</svg>\n')


def brush_pts(pts, rs):
    """Cadena de capsulas por puntos con radios propios."""
    out = pathops.Path()
    for i in range(len(pts) - 1):
        out = union(out, capsule(pts[i][0], pts[i][1], rs[i], pts[i + 1][0], pts[i + 1][1], rs[i + 1]))
    return out


def arc_brush(cx, cy, R, a0, a1, r0, r1, n=48, ease=1.0):
    """Trazo de grosor variable sobre un arco de circunferencia (grados, sentido SVG)."""
    pts, rs = [], []
    for i in range(n + 1):
        t = i / n
        a = math.radians(a0 + (a1 - a0) * t)
        pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
        rs.append(r0 + (r1 - r0) * (t ** ease))
    return brush_pts(pts, rs)


def spline_brush(segs, radii, n_per=24):
    """segs: lista de cubicas [(p0,p1,p2,p3), ...] encadenadas.
    radii: lista de (t, r) con t en [0,1] a lo largo del numero de segmentos."""
    pts = []
    for si, (a, b, c, d) in enumerate(segs):
        for i in range(n_per + (1 if si == len(segs) - 1 else 0)):
            pts.append(bez(a, b, c, d, i / n_per))
    # longitud acumulada
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    tot = L[-1]
    rs = []
    for l in L:
        t = l / tot
        for j in range(len(radii) - 1):
            t0, r0 = radii[j]
            t1, r1 = radii[j + 1]
            if t0 <= t <= t1:
                u = (t - t0) / (t1 - t0) if t1 > t0 else 0
                u = u * u * (3 - 2 * u)  # suave
                rs.append(r0 + (r1 - r0) * u)
                break
        else:
            rs.append(radii[-1][1])
    return brush_pts(pts, rs)


def vesica(x1, y1, x2, y2, bulge=0.35):
    """Hoja (interseccion de dos circulos) entre dos puntas. bulge = semiancho / longitud."""
    L = math.hypot(x2 - x1, y2 - y1)
    h = bulge * L                 # semiancho
    R = (h * h + (L / 2) ** 2) / (2 * h)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    nx, ny = -(y2 - y1) / L, (x2 - x1) / L
    d = R - h
    c1 = circle(mx + nx * d, my + ny * d, R)
    c2 = circle(mx - nx * d, my - ny * d, R)
    return inter(c1, c2)
