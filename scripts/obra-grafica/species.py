"""Siete siluetas de especie, misma construccion:
primitivas -> union -> empalme concavo uniforme -> redondeo convexo -> suelo -> huecos.
"""
import os
import sys

from geo import (P, circle, ellipse, rect, poly, union, diff, inter, capsule,
                 brush, line_cut, stroke, close_, open_, to_d, area, ncontours)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out_species")
os.makedirs(OUT, exist_ok=True)

GROUND = 108
EYE = 2.5        # radio de todos los ojos
CUT = 2.4        # ancho de todos los cortes
FILLET = 2.2     # empalme de esquinas concavas
SOFT = 1.2       # redondeo de esquinas convexas


def finish(body, cuts=(), eyes=(), sc=1.0, base=()):
    """Une, escala sobre el suelo, centra, empalma, recorta al suelo y vacia.
    Radios de empalme, ancho de corte y ojo NO se escalan: son de la familia."""
    s = union(*body, *[rect(a, 103.5, b, 112) for a, b in base])   # suelo macizo entre apoyos
    s = s.transform(sc, 0, 0, sc, 60 - sc * 60, GROUND - sc * GROUND)
    x0, y0, x1, y1 = inter(s, rect(-50, -50, 170, GROUND)).bounds
    dx = 60 - (x0 + x1) / 2
    m = (sc, 0, 0, sc, 60 - sc * 60 + dx, GROUND - sc * GROUND)
    s = s.transform(1, 0, 0, 1, dx, 0)
    s = close_(s, FILLET)
    s = open_(s, SOFT)
    s = inter(s, rect(-10, -10, 130, GROUND))
    cutp = [stroke(P(d).transform(*m), CUT) for d in cuts]
    holes = [circle(m[0] * x + m[4], m[3] * y + m[5], EYE) for x, y in eyes]
    return diff(s, union(*cutp, *holes))


def eye(x, y):
    return (x, y)


# ---------------------------------------------------------------- gato
def gato():
    body = [
        P("M 36 108 C 22 106 16 96 18 84 C 20 72 30 62 42 55 C 50 50 54 47 58 45 "
          "L 74 49 C 80 53 83 60 82 66 C 81 71 80 74 80 78 L 80 108 Z"),
        circle(66, 37, 14),                                        # cabeza
        P("M 66 26 L 80.5 31 C 82.6 34 83.2 37 82.6 39.5 C 82 42 80.6 43.4 79.4 44.4 "
          "C 79.2 46.4 78 48.2 76 49.5 C 80 53 83 58 82 66 L 60 66 Z"),  # perfil: nariz, boca, pecho
        poly([(52, 35), (55.5, 15), (65, 24)]),                    # oreja trasera
        poly([(66, 24), (75, 13), (80.5, 31)]),                    # oreja delantera
        capsule(74, 70, 6, 75, 103, 5),                            # patas delanteras
        brush((26, 103.5), (46, 105), (78, 105), (90, 102), 4.5, 4),  # cola por delante
        brush((90, 102), (97, 99), (99, 94), (97, 88), 4, 3.3),
    ]
    cuts = ["M 58 98 C 61 86 54 76 40 74", "M 40 97.5 C 56 99.6 72 99.6 88 96.8"]
    return finish(body, cuts, [eye(72, 35)], sc=0.97)


# ---------------------------------------------------------------- perro
def perro():
    body = [
        P("M 30 108 C 20 104 16 92 20 80 C 24 66 36 58 46 52 C 52 48 54 44 56 40 "
          "L 76 44 C 80 50 84 56 83 64 L 82 108 Z"),
        circle(65, 30, 12),                                         # craneo
        P("M 70 27 C 76 25 86 26 90 28 C 94 30 94 38 92 41 C 88 44 78 44 72 42 Z"),  # hocico
        circle(91.5, 31.5, 3.6),                                    # trufa
        P("M 58 20 C 64 18 66 24 64 32 C 62 40 60 46 56 48 C 50 50 48 44 49 38 "
          "C 50 30 52 22 58 20 Z"),                                 # oreja
        capsule(74, 62, 6.5, 77, 103, 5.2),                         # pata delantera
        ellipse(80, 104.5, 7.5, 3.6),
        brush((24, 104), (12, 106), (5, 100), (7, 90), 4, 3),       # cola
    ]
    cuts = ["M 64 22 C 67 30 64 42 58 49", "M 62 104 C 66 90 60 78 46 74"]
    return finish(body, cuts, [eye(72, 27)], sc=0.96, base=[(14, 40)])


# ---------------------------------------------------------------- conejo
def conejo():
    body = [
        ellipse(52, 84, 30, 24),
        ellipse(80, 55, 14.5, 12.5, 22),
        ellipse(67, 32, 5.6, 15.5, -24),        # oreja trasera
        ellipse(76.5, 31, 6, 16, -8),           # oreja delantera
        circle(22, 78, 6.5),                    # rabo
        capsule(84, 88, 5, 86, 104, 4.5),       # mano
        ellipse(52, 105, 18, 3.8),              # pie
    ]
    cuts = ["M 30 100 C 26 84 36 70 52 72"]
    return finish(body, cuts, [eye(84, 51)])


# ---------------------------------------------------------------- huron
def huron():
    body = [
        P("M 24 100 C 20 84 28 70 42 70 C 54 70 60 78 66 80 C 72 72 76 64 82 57 "
          "L 96 62 C 94 70 92 80 94 90 L 98 108 L 30 108 Z"),
        ellipse(91, 54, 12, 9, -4),                                  # cabeza
        capsule(96, 55, 7.5, 108, 55, 4),                            # hocico
        circle(83, 46, 4.6),                                         # oreja
        capsule(92, 92, 6, 100, 104, 4.4),                           # mano
        ellipse(103, 105, 6.5, 3.4),
        brush((26, 100), (14, 104), (5, 102), (3, 90), 7.5, 4.5),    # cola
    ]
    cuts = ["M 44 106 C 34 98 36 84 50 80"]
    return finish(body, cuts, [eye(93, 51)], sc=0.97, base=[(12, 40)])


# ---------------------------------------------------------------- ave
def ave():
    body = [
        ellipse(64, 74, 18, 25, 14),                                 # cuerpo
        circle(70, 40, 13),                                          # cabeza
        P("M 79 39 C 84.5 40 87 44.5 86.3 48.5 C 85.9 51 84.8 52.8 83.2 54 "
          "C 82.8 51.5 81.2 50.6 78 50.6 Z"),                        # pico
        brush((54, 90), (46, 97), (38, 103), (30, 108), 6.2, 2.8),   # cola
        capsule(52, 104.5, 3.5, 98, 104.5, 3.5),                     # percha
    ]
    cuts = ["M 54 60 C 50 72 51 86 60 95"]
    return finish(body, cuts, [eye(74, 37)], sc=1.12)


# ---------------------------------------------------------------- tortuga
def reptil():
    dome = inter(ellipse(54, 94, 40, 56), rect(0, 0, 120, 94))
    body = [
        dome,
        capsule(12, 92, 3, 96, 92, 3),           # borde del caparazon
        capsule(84, 88, 7, 98, 62, 7.5),         # cuello alzado
        ellipse(102, 58, 11, 8, -10),            # cabeza
        capsule(82, 92, 7, 84, 104, 7),          # pata delantera
        capsule(28, 92, 7, 26, 104, 7),          # pata trasera
        P("M 14 90 L 6 96 L 16 96 Z"),           # cola
    ]
    cuts = [
        "M 16 88 L 92 88",
        "M 37 88 L 41 66 L 67 66 L 71 88",
        "M 41 66 L 35 48 M 67 66 L 73 48 M 54 66 L 54 38",
    ]
    return finish(body, cuts, [eye(105, 55)])


# ---------------------------------------------------------------- cobaya
def roedor():
    body = [
        P("M 14 92 C 12 72 26 58 46 56 C 60 54.5 72 52 84 52.5 C 98 53 105 64 106 76 "
          "C 107 86 104 92 96 96 L 30 102 C 20 100 15 97 14 92 Z"),
        ellipse(79, 54, 7.5, 5, -15),                                # oreja caida
        capsule(92, 98, 4, 94, 104, 4), ellipse(97, 105, 5.5, 3.2),  # mano
        capsule(34, 98, 5, 34, 104, 5), ellipse(38, 105, 7, 3.2),    # pie
        ellipse(60, 97, 28, 8),                                      # vientre
    ]
    cuts = ["M 72 59 C 76 61.5 83 61 87 57"]
    return finish(body, cuts, [eye(93, 68)])


SPECIES = {
    "perro": perro, "gato": gato, "conejo": conejo, "huron": huron,
    "ave": ave, "reptil": reptil, "roedor": roedor,
}

if __name__ == "__main__":
    only = sys.argv[2:]
    for k, fn in SPECIES.items():
        if only and k not in only:
            continue
        shape = fn()
        d = to_d(shape, 1)
        b = shape.bounds
        info = {"area": round(area(shape)), "bounds": [round(v, 1) for v in b],
                "h": round(b[3] - b[1], 1), "len": len(d), "contours": ncontours(shape)}
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
               f'<path fill="currentColor" fill-rule="evenodd" d="{d}"/></svg>\n')
        with open(os.path.join(OUT, f"{k}.svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(svg)
        print(k, info)
