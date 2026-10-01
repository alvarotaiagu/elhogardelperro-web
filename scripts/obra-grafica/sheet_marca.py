"""Hoja de contacto de las marcas: claro y oscuro, grande y a 32 px."""
import os
import sys

M = sys.argv[1]          # carpeta marca/
NEG = sys.argv[2]        # negativos solo para la hoja
OUT = sys.argv[3]


def rd(p):
    with open(p, encoding="utf-8") as f:
        return f.read().strip()


def h(svg, px):
    return svg.replace("<svg ", f'<svg height="{px}" ', 1)


logos_claro = [
    ("Lontra · demo", rd(f"{M}/logo.svg")),
    ("Arxila · prueba, solo tipográfico", rd(f"{M}/pruebas/arxila/logo.svg")),
    ("O Corzo · prueba", rd(f"{M}/pruebas/corzo/logo.svg")),
]
logos_osc = [
    ("Lontra · demo", rd(f"{NEG}/lontra-logo.svg")),
    ("Arxila · prueba, solo tipográfico", rd(f"{NEG}/arxila-logo.svg")),
    ("O Corzo · prueba", rd(f"{NEG}/corzo-logo.svg")),
]
isos_claro = [("Lontra · isotipo", rd(f"{M}/isotipo.svg")), ("O Corzo · isotipo", rd(f"{M}/pruebas/corzo/isotipo.svg"))]
isos_osc = [("Lontra · isotipo", rd(f"{M}/isotipo.svg")), ("O Corzo · isotipo", rd(f"{NEG}/corzo-isotipo.svg"))]
HEIGHTS = [100, 92, 72]


def panel(cls, title, logos, isos):
    rows = "".join(
        f'<div class=row><span class=lab>{lab}</span><div class=big>{h(s, HEIGHTS[i])}</div>'
        f'<div class=sm>{h(s, 32)}</div></div>' for i, (lab, s) in enumerate(logos))
    iso = "".join(
        f'<div class=iso><div class=big>{h(s, 220)}</div><div class=sm>{h(s, 32)}</div>'
        f'<span class=lab>{lab}</span></div>' for lab, s in isos)
    return f'<section class={cls}><h2>{title}</h2>{rows}<div class=isos>{iso}</div></section>'


html = f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;background:#E9E4DA;font:500 12px/1.3 system-ui,sans-serif;width:1400px}}
section{{padding:30px 40px 36px}}
.claro{{background:#F6F2EA;color:#6A6272}} .oscuro{{background:#19171C;color:#9A93A3}}
h2{{margin:0 0 18px;font:600 12px system-ui;letter-spacing:.16em;text-transform:uppercase}}
.row{{display:grid;grid-template-columns:230px 700px 1fr;align-items:center;min-height:128px;
     border-top:1px solid rgba(128,128,128,.22)}}
.row .big svg{{display:block}}
.isos{{display:flex;gap:90px;margin-top:22px;padding-top:26px;border-top:1px solid rgba(128,128,128,.22)}}
.iso{{display:flex;align-items:flex-end;gap:28px}}
.iso .lab{{align-self:flex-start}}
</style>
{panel("claro", "Sobre claro · grande y a 32 px", logos_claro, isos_claro)}
{panel("oscuro", "Sobre oscuro · versión en negativo solo para esta hoja", logos_osc, isos_osc)}
"""
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("ok", OUT)
