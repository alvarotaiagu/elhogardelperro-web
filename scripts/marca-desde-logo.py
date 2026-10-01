"""marca-desde-logo.py — propone la paleta de marca.json a partir del logo.

  python scripts/marca-desde-logo.py                       (usa marca/)
  python scripts/marca-desde-logo.py --personalidad moderna
  python scripts/marca-desde-logo.py --pareja serif-calida --dir marca/pruebas/corzo
  python scripts/marca-desde-logo.py --solo-ver            (no escribe, solo propone)
  python scripts/marca-desde-logo.py --slug lontra         (la primera vez: id de la marca)

Qué hace:
  1. Saca los colores dominantes del logo. Si existe marca/_logo.png (lo deja
     scripts/logo.mjs) los pesa por superficie; si no, lee los colores del SVG.
  2. Reparte papeles: ACENTO = el color más saturado del logo; TINTA = su color
     más oscuro (o uno casi negro teñido del acento); ACENTO 2 = otro color del
     logo con otro matiz (o un tono claro derivado).
  3. Fondo y superficie según la personalidad: cercana (claro cálido),
     clinica (blanco limpio) o moderna (oscuro).
  4. Imprime los contrastes principales y escribe marca/marca.json conservando
     el resto de claves (slug, densidad, forma_hero…).

El informe COMPLETO de contraste (acento-texto, botón, banda, cortina…) lo hace
scripts/aplicar.mjs, que es quien deriva los tokens: este script no cambia
nunca un color del logo, solo propone el reparto.
"""
import argparse, json, math, os, re, sys
from collections import Counter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ───────────── color ─────────────
def hex_a_rgb(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def rgb_a_hex(rgb):
    return '#' + ''.join('%02X' % max(0, min(255, round(v))) for v in rgb)

def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

def delin(v):
    v = max(0.0, min(1.0, v))
    return 255 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)

def luminancia(h):
    r, g, b = (lin(v) for v in hex_a_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def a_oklch(h):
    r, g, b = (lin(v) for v in hex_a_rgb(h))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(A, B), (math.degrees(math.atan2(B, A)) + 360) % 360

def de_oklch(L, C, H):
    for _ in range(40):
        a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
        l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
        m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
        s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
        rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
               -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
               -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
        if all(-0.0005 <= v <= 1.0005 for v in rgb):
            return rgb_a_hex(delin(v) for v in rgb)
        C *= 0.93
    return rgb_a_hex(delin(v) for v in rgb)

def dist_matiz(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)

# ───────────── colores del logo ─────────────
def colores_png(ruta):
    from PIL import Image
    im = Image.open(ruta).convert('RGBA')
    im.thumbnail((400, 400))
    px = [p[:3] for p in im.getdata() if p[3] >= 128]
    if not px:
        sys.exit('El PNG es todo transparente')
    base = Image.new('RGB', (len(px), 1))
    base.putdata(px)
    q = base.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    cuenta = Counter(q.getdata())
    total = sum(cuenta.values())
    out = []
    for idx, n in cuenta.most_common():
        rgb = pal[idx * 3: idx * 3 + 3]
        out.append((rgb_a_hex(rgb), n / total))
    return out

def colores_svg(*rutas):
    cuenta = Counter()
    for ruta in rutas:
        if not os.path.exists(ruta): continue
        src = open(ruta, encoding='utf-8').read()
        for m in re.finditer(r'(?:fill|stroke|stop-color)\s*[=:]\s*"?\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b', src):
            cuenta[rgb_a_hex(hex_a_rgb(m.group(1)))] += 1
    total = sum(cuenta.values()) or 1
    return [(c, n / total) for c, n in cuenta.most_common()]

# ───────────── reparto ─────────────
def proponer(colores, personalidad):
    # fuera el blanco de fondo de un PNG, que no es de la marca
    utiles = [(c, p) for c, p in colores if a_oklch(c)[0] < 0.97]
    if not utiles:
        utiles = colores
    info = [(c, p) + a_oklch(c) for c, p in utiles]          # (hex, peso, L, C, H)

    cromaticos = [x for x in info if x[3] > 0.06 and 0.3 < x[2] < 0.9]
    if cromaticos:
        acento = max(cromaticos, key=lambda x: x[3] * math.sqrt(x[1]))
    else:
        acento = None
    oscuros = [x for x in info if x[2] < 0.36]
    tinta_logo = min(oscuros, key=lambda x: x[2]) if oscuros else None

    notas = []
    if acento is None:
        # logo sin color: se propone un acento según la personalidad y se dice
        acento_hex = {'cercana': '#E0663A', 'clinica': '#1F6FB2', 'moderna': '#C9E265'}[personalidad]
        notas.append('El logo no tiene un color saturado: acento PROPUESTO %s (cámbialo si la marca usa otro).' % acento_hex)
        H = a_oklch(acento_hex)[2]
    else:
        acento_hex = acento[0]
        H = acento[4]

    hue_ref = tinta_logo[4] if tinta_logo and tinta_logo[3] > 0.02 else H

    otros = [x for x in cromaticos if x[0] != acento_hex and dist_matiz(x[4], H) > 40]
    if otros:
        acento2 = max(otros, key=lambda x: x[3] * math.sqrt(x[1]))[0]
    else:
        acento2 = de_oklch(0.82, 0.07, hue_ref)
        notas.append('Acento 2 derivado (el logo solo tiene un color con matiz).')

    if personalidad == 'moderna':
        fondo = de_oklch(0.18, 0.03, hue_ref)
        superficie = de_oklch(0.23, 0.035, hue_ref)
        tinta = de_oklch(0.965, 0.012, hue_ref)
        if acento_hex and a_oklch(acento_hex)[0] < 0.55:
            # un acento oscuro no se ve sobre fondo oscuro: se aclara solo para la web
            L0, C0, H0 = a_oklch(acento_hex)
            notas.append('Acento %s demasiado oscuro para fondo oscuro: se usa el acento 2 del logo si lo hay.' % acento_hex)
            if otros and a_oklch(otros[0][0])[0] > 0.6:
                acento_hex, acento2 = otros[0][0], acento_hex
            else:
                acento_hex = de_oklch(0.72, C0, H0)
    else:
        if personalidad == 'clinica':
            fondo = de_oklch(0.992, 0.003, hue_ref)
            superficie = de_oklch(0.962, 0.008, hue_ref)
        else:
            fondo = de_oklch(0.975, 0.012, hue_ref)
            superficie = de_oklch(0.94, 0.022, hue_ref)
        tinta = tinta_logo[0] if tinta_logo and tinta_logo[2] < 0.3 else de_oklch(0.23, 0.045, hue_ref)

    return {'fondo': fondo, 'superficie': superficie, 'tinta': tinta, 'acento': acento_hex, 'acento2': acento2}, notas

PAREJA_POR_DEFECTO = {'cercana': 'redondeada', 'clinica': 'grotesca-clinica', 'moderna': 'geometrica-moderna'}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='marca')
    ap.add_argument('--personalidad', choices=['cercana', 'clinica', 'moderna'])
    ap.add_argument('--pareja')
    ap.add_argument('--slug', help='identificador corto de la marca (a-z, 0-9, guiones)')
    ap.add_argument('--solo-ver', action='store_true')
    a = ap.parse_args()

    carpeta = os.path.join(RAIZ, a.dir)
    ruta_json = os.path.join(carpeta, 'marca.json')
    conf = json.load(open(ruta_json, encoding='utf-8')) if os.path.exists(ruta_json) else {}

    png = next((os.path.join(carpeta, n) for n in ('_logo.png', 'logo.png', 'logo.jpg') if os.path.exists(os.path.join(carpeta, n))), None)
    del_svg = colores_svg(os.path.join(carpeta, 'logo.svg'), os.path.join(carpeta, 'isotipo.svg'))
    if png and del_svg:
        # el PNG da el peso (superficie); el SVG da el color EXACTO. La cuantización
        # mezcla los bordes antialiasados y inventa tonos intermedios que no son del logo.
        exactos = [c for c, _ in del_svg]
        peso = Counter()
        for c, p in colores_png(png):
            rgb = hex_a_rgb(c)
            cerca = min(exactos, key=lambda e: sum((a - b) ** 2 for a, b in zip(hex_a_rgb(e), rgb)))
            peso[cerca] += p
        colores = [(c, p) for c, p in peso.most_common() if p > 0]
        colores += [(c, 0.01) for c in exactos if c not in peso]
        origen = os.path.basename(png) + ' (superficie) ajustado a los colores exactos del SVG'
    elif png:
        colores = colores_png(png)
        origen = os.path.basename(png) + ' (por superficie)'
    else:
        colores = colores_svg(os.path.join(carpeta, 'logo.svg'), os.path.join(carpeta, 'isotipo.svg'))
        origen = 'logo.svg (por apariciones; ejecuta scripts/logo.mjs para pesar por superficie)'
    if not colores:
        sys.exit('No encuentro colores en el logo de ' + carpeta)

    personalidad = a.personalidad or conf.get('personalidad') or 'cercana'
    pareja = a.pareja or conf.get('pareja') or PAREJA_POR_DEFECTO[personalidad]
    col, notas = proponer(colores, personalidad)

    banda = col['tinta'] if personalidad != 'moderna' else col['fondo']
    logo_fuertes = [c for c, p in colores if p > 0.08 and a_oklch(c)[0] < 0.97]
    peor = min((contraste(c, banda) for c in logo_fuertes), default=1)
    logo_oscuro = 'original' if peor >= 3 else 'mono'

    print('Colores del logo (' + origen + '):')
    for c, p in colores[:8]:
        L, C, H = a_oklch(c)
        print('  %s  %4.1f %%   L %.2f  C %.3f  H %3.0f' % (c, p * 100, L, C, H))
    print('\nPropuesta (%s, pareja %s):' % (personalidad, pareja))
    for k in ('fondo', 'superficie', 'tinta', 'acento', 'acento2'):
        print('  %-11s %s' % (k, col[k]))
    print('\nContrastes principales:')
    filas = [('tinta / fondo', col['tinta'], col['fondo'], 4.5), ('tinta / superficie', col['tinta'], col['superficie'], 4.5),
             ('acento / fondo', col['acento'], col['fondo'], 3.0)]
    for nombre, x, y, mn in filas:
        r = contraste(x, y)
        print('  %s %-20s %5.2f:1  (mín. %s)' % ('✓' if r >= mn else '✗', nombre, r, mn))
    print('  · El acento como TEXTO lo corrige aplicar.mjs con --acento-texto (el color del logo no se toca).')
    print('  · Logo sobre fondo oscuro: «%s» (peor contraste del logo sobre la banda %.2f:1)' % (logo_oscuro, peor))
    for n in notas:
        print('  ! ' + n)

    if a.solo_ver:
        return
    if a.slug:
        conf['slug'] = a.slug
    if not conf.get('slug'):
        sys.exit('Falta el slug de la marca: --slug nombre-corto')
    conf.update({'personalidad': personalidad, 'pareja': pareja, 'colores': col})
    conf.setdefault('logo_en_oscuro', logo_oscuro)
    conf.setdefault('densidad', 'marca')
    conf.setdefault('duotono', True)
    conf.setdefault('forma_hero', 'isotipo')
    json.dump(conf, open(ruta_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(ruta_json, 'a', encoding='utf-8').write('\n')
    print('\n✓ Escrito ' + os.path.relpath(ruta_json, RAIZ) + '. Siguiente: node scripts/aplicar.mjs')

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
