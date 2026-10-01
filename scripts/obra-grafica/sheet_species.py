"""Hoja de trabajo (con guias) o de contacto (limpia) de las especies."""
import os
import sys

src = sys.argv[1]
out = sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "work"
ORDER = ["perro", "gato", "conejo", "huron", "ave", "reptil", "roedor"]
NAMES = {"perro": "perro", "gato": "gato", "conejo": "conejo", "huron": "hurón",
         "ave": "ave", "reptil": "reptil", "roedor": "roedor"}


def svg_of(k):
    with open(os.path.join(src, f"{k}.svg"), encoding="utf-8") as f:
        return f.read().strip()


def sized(svg, px):
    return svg.replace("<svg ", f'<svg width="{px}" height="{px}" ', 1)


guides = ('<svg class="g" viewBox="0 0 120 120" width="{px}" height="{px}">'
          '<line x1="0" x2="120" y1="108" y2="108" stroke="#e33" stroke-width=".4"/>'
          '<line x1="0" x2="120" y1="{y70}" y2="{y70}" stroke="#39f" stroke-width=".3"/>'
          '<line x1="0" x2="120" y1="{y85}" y2="{y85}" stroke="#39f" stroke-width=".3"/>'
          '<rect x=".2" y=".2" width="119.6" height="119.6" fill="none" stroke="#bbb" stroke-width=".4"/>'
          + ''.join(f'<line x1="{i}" x2="{i}" y1="0" y2="120" stroke="#0a0" stroke-opacity=".18" stroke-width=".25"/><line y1="{i}" y2="{i}" x1="0" x2="120" stroke="#0a0" stroke-opacity=".18" stroke-width=".25"/>' for i in range(10,120,10)) +
          '</svg>')

if mode == "work":
    BIG = 300
    cells = []
    for k in ORDER:
        s = svg_of(k)
        g = guides.format(px=BIG, y70=108 - 0.70 * 108, y85=108 - 0.85 * 108)
        cells.append(f'<div class="c"><div class="big">{sized(s, BIG)}{g}</div>'
                     f'<div class="sm">{sized(s, 40)}{sized(s, 32)}{sized(s, 24)}'
                     f'<span>{k}</span></div></div>')
    row = "".join(sized(svg_of(k), 40) for k in ORDER)
    html = f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;padding:16px;background:#f4f1ea;color:#231B33;font:13px system-ui}}
.w{{display:flex;flex-wrap:wrap;gap:14px}}
.c{{background:#fff}} .big{{position:relative;width:{BIG}px;height:{BIG}px}}
.big svg{{position:absolute;inset:0}} .big svg:first-child{{color:#231B33cc}} .g{{pointer-events:none}}
.sm{{display:flex;gap:10px;align-items:end;padding:8px}}
.row{{margin-top:16px;display:flex;gap:18px;background:#fff;padding:12px}}
.row2{{display:flex;gap:18px;background:#231B33;color:#f4f1ea;padding:12px}}
</style><div class=w>{''.join(cells)}</div><div class=row>{row}</div><div class=row2>{row}</div>"""
else:
    big = "".join(f'<figure>{sized(svg_of(k), 120)}<figcaption>{NAMES[k]}</figcaption></figure>'
                  for k in ORDER)
    small = "".join(f'<figure>{sized(svg_of(k), 40)}</figure>' for k in ORDER)
    html = f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;padding:28px 32px;background:#F6F2EA;color:#231B33;font:500 13px/1.2 system-ui;width:1016px}}
h1{{font:600 13px system-ui;letter-spacing:.14em;text-transform:uppercase;margin:0 0 18px;color:#6d6478}}
.r{{display:flex;justify-content:space-between;align-items:end}}
figure{{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}}
figcaption{{color:#6d6478}}
.s{{margin-top:26px;padding-top:22px;border-top:1px solid #ddd5c8}}
.s figure{{width:120px}}
.d{{margin-top:22px;background:#231B33;color:#FF6A3D;padding:18px 0;border-radius:6px}}
.d figure{{width:120px}}
</style>
<h1>Especies · 120 px arriba, 40 px abajo (sobre claro y sobre oscuro)</h1><div class=r>{big}</div>
<div class="r s">{small}</div>
<div class="r d">{small}</div>"""

with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("sheet", out)
