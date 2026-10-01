"""vectorizar-logo.py — logo de El Hogar del Perro (JPG de 664×549 de su Facebook) → SVG.

  python cliente/vectorizar-logo.py

No sirve scripts/vectorizar.py tal cual: el perfil del gato es una línea de
menos de un píxel y el JPG la deja a trozos; potrace la convierte en guiones
dentados. Aquí se hace por capas, con los colores medidos en el original:

  - perro   #265691  macizo, potrace sobre ×4 LANCZOS + desenfoque
  - perfil  #265691  línea central (penlib de Cervantes), con los cortes cosidos,
                     como trazo de grosor fijo
  - gato    #FFFFFF  el blanco encerrado por el perfil, para que se lea sobre color
  - texto   #376092  «El Hogar del Perro»; #17375E en «Centro Veterinario», H y P

Deja cliente/logo-vector.svg (todo) y cliente/isotipo-vector.svg (solo el
dibujo, con la silueta maciza marcada data-silueta).
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
import potrace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'asesoria-cervantes-carballo-web', 'scripts'))
from penlib import adelgazar, trazos_de, rdp, a_bezier  # noqa: E402

ORIG = 'cliente/fb-og.jpg'
AZUL, TEXTO, MARINO, BLANCO = '#265691', '#376092', '#17375E', '#FFFFFF'
CORTE_TEXTO = 417   # px del original: por encima, dibujo; por debajo, texto
GROSOR = 0.95       # grosor del perfil, en px del original
COSER = 16.0        # hueco máximo que se cose entre dos tramos del perfil (px del original)
# las dos patas del gato están abiertas por abajo en el original: estas paredes
# (invisibles) solo sirven para saber qué blanco es gato
PAREDES = [((175, 408), (233, 408)), ((431, 407), (500, 398)),   # bases de las patas
           ((137.5, 161.5), (146, 161.5)), ((130.5, 171.5), (148, 183)),  # cola contra el perro
           ((407, 278.5), (434, 260)),                                     # barbilla contra la cabeza
           ((345, 216), (358, 206)),                                       # nuca: cuerpo del perro contra la cabeza
           ((179.5, 315), (178, 321))]                                     # pata trasera: trazo contra el macizo


def gris(escala, desenfoque):
    im = Image.open(ORIG).convert('L')
    im = im.resize((im.width * escala, im.height * escala), Image.LANCZOS)
    if desenfoque:
        im = im.filter(ImageFilter.GaussianBlur(desenfoque))
    return np.asarray(im).astype(float)


def disco(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def trazar(mascara, esc, turd=60):
    # potracer: se le pasa el FONDO (invierte solo), en bool
    curvas = potrace.Bitmap(~mascara).trace(turdsize=turd, alphamax=1.1, opticurve=True, opttolerance=0.4)
    f = lambda v: '%.2f' % (v / esc)
    partes = []
    for c in curvas:
        d = ['M' + f(c.start_point.x) + ' ' + f(c.start_point.y)]
        for s in c.segments:
            if s.is_corner:
                d.append('L%s %sL%s %s' % (f(s.c.x), f(s.c.y), f(s.end_point.x), f(s.end_point.y)))
            else:
                d.append('C%s %s %s %s %s %s' % (f(s.c1.x), f(s.c1.y), f(s.c2.x), f(s.c2.y), f(s.end_point.x), f(s.end_point.y)))
        partes.append(''.join(d) + 'Z')
    return ''.join(partes)


def suavizar(t, r=5):
    if len(t) < 2 * r + 1:
        return t
    xs = np.array(t)
    pad = np.vstack([np.repeat(xs[:1], r, 0), xs, np.repeat(xs[-1:], r, 0)])
    k = np.ones(2 * r + 1) / (2 * r + 1)
    out = np.column_stack([np.convolve(pad[:, i], k, 'valid') for i in (0, 1)])
    out[0], out[-1] = xs[0], xs[-1]
    return [tuple(v) for v in out]


def coser(trazos, hueco, max_giro=1.0):
    """Une tramos cuyos extremos quedan cerca y siguen la misma dirección."""
    trazos = [list(t) for t in trazos]

    def dir_fin(t):
        k = min(14, len(t) - 1); a, b = t[-1 - k], t[-1]
        return math.atan2(b[1] - a[1], b[0] - a[0])

    def giro(a, b):
        return abs((a - b + math.pi) % (2 * math.pi) - math.pi)

    while True:
        mejor = None
        for i, a in enumerate(trazos):
            for ai in (a, a[::-1]):
                for j, b in enumerate(trazos):
                    if j == i:
                        continue
                    for bj in (b, b[::-1]):
                        p, q = ai[-1], bj[0]
                        d = math.hypot(q[0] - p[0], q[1] - p[1])
                        if d > hueco or d < 1e-6:
                            continue
                        da = dir_fin(ai)
                        db = dir_fin(bj[::-1]) + math.pi  # dirección de salida de b
                        dpq = math.atan2(q[1] - p[1], q[0] - p[0])
                        g = max(giro(da, dpq), giro(dpq, db))
                        if g < max_giro and (mejor is None or d + g * 4 < mejor[0]):
                            mejor = (d + g * 4, i, j, ai, bj)
        if not mejor:
            return trazos
        _, i, j, ai, bj = mejor
        nuevo = ai + bj
        trazos = [t for k, t in enumerate(trazos) if k not in (i, j)] + [nuevo]


def main():
    w0, h0 = Image.open(ORIG).size

    # ── perro macizo y texto: ×4, LANCZOS y desenfoque suave antes del umbral
    E = 4
    L4 = gris(E, 1.6)
    Y4 = np.arange(L4.shape[0])[:, None]
    arriba4 = np.broadcast_to(Y4 < CORTE_TEXTO * E, L4.shape)
    perro = (L4 < 167) & arriba4
    perro = ndi.binary_opening(perro, disco(2))
    etq, n = ndi.label(perro)
    tam = ndi.sum(perro, etq, range(1, n + 1))
    perro = np.isin(etq, 1 + np.flatnonzero(tam >= 30 * E * E))

    tinta = (L4 < 172) & ~arriba4
    etq, n = ndi.label(tinta)
    nucleo = ndi.median(L4, etq, range(1, n + 1))
    marino = np.isin(etq, 1 + np.flatnonzero(nucleo < 70))
    medio = tinta & ~marino

    # ── perfil del gato: línea central a ×2
    S = 2
    L2 = gris(S, 0.8)
    Y2 = np.arange(L2.shape[0])[:, None]
    arriba2 = np.broadcast_to(Y2 < CORTE_TEXTO * S, L2.shape)
    perro2 = np.asarray(Image.fromarray(perro.astype(np.uint8) * 255).resize(L2.shape[::-1], Image.BILINEAR)) > 127
    # umbral fijo + sombrero de copa: la línea desvaída de la cola no llega a 238
    sombrero = ndi.maximum_filter(L2, 7) - L2
    linea = ((L2 < 238) | (sombrero > 6)) & arriba2
    linea = ndi.binary_closing(linea, disco(1))
    esq = adelgazar(linea).astype(bool)
    # fuera el esqueleto que cae dentro o pegado al perro: ahí manda el macizo
    esq &= ndi.distance_transform_edt(~perro2) > 3.0
    trazos = [suavizar([(p[1] / S, p[0] / S) for p in t]) for t in trazos_de(esq, podar_umbral=5, min_pts=6)]
    trazos = coser(trazos, COSER)
    # los extremos que se quedaron cortos junto al perro se alargan hasta tocarlo
    dist_perro = ndi.distance_transform_edt(~perro)
    finales = []
    for t in trazos:
        t = list(t)
        for lado in (0, 1):
            if lado:
                t = t[::-1]
            x, y = t[-1]
            if dist_perro[min(int(y * E), perro.shape[0] - 1), min(int(x * E), perro.shape[1] - 1)] < 3.5 * E:
                k = min(5, len(t) - 1); a = t[-1 - k]
                dx, dy = x - a[0], y - a[1]; n_ = math.hypot(dx, dy) or 1
                t.append((x + dx / n_ * 2.5, y + dy / n_ * 2.5))
            if lado:
                t = t[::-1]
        if sum(math.hypot(t[i + 1][0] - t[i][0], t[i + 1][1] - t[i][1]) for i in range(len(t) - 1)) >= 6:
            finales.append(rdp(suavizar(t, 3), 0.5))
    print('perfil: %d trazos' % len(finales), file=sys.stderr)
    for t in finales:
        print('  %5.1f,%5.1f -> %5.1f,%5.1f' % (t[0] + t[-1]), file=sys.stderr)

    # ── gato blanco: lo que el perfil y el perro dejan encerrado
    lienzo = Image.new('L', (w0 * E, h0 * E), 0)
    dib = ImageDraw.Draw(lienzo)
    for t in finales:
        dib.line([(x * E, y * E) for x, y in t], fill=255, width=int(GROSOR * E * 2), joint='curve')
    for a, b in PAREDES:
        dib.line([(a[0] * E, a[1] * E), (b[0] * E, b[1] * E)], fill=255, width=int(2.5 * E))
    muro = (np.asarray(lienzo) > 0) | perro
    libre = ~muro
    etq, n = ndi.label(libre)
    borde = set(np.unique(np.concatenate([etq[0], etq[-1], etq[:, 0], etq[:, -1]]))) - {0}
    tam = ndi.sum(libre, etq, range(1, n + 1))
    gato = np.zeros_like(libre)
    for i in range(1, n + 1):
        if i not in borde and tam[i - 1] > 300 * E * E:
            gato |= etq == i
    gato = ndi.binary_dilation(gato, disco(int(GROSOR * E))) & arriba4
    print('zonas blancas encerradas: %d' % ndi.label(gato)[1], file=sys.stderr)

    # ── silueta del isotipo: perro + perfil + gato, maciza
    sil = ndi.binary_fill_holes(ndi.binary_closing(muro | gato, disco(4 * E)))
    etq, n = ndi.label(sil)
    tam = ndi.sum(sil, etq, range(1, n + 1))
    sil = etq == 1 + int(np.argmax(tam))
    Image.fromarray(sil.astype(np.uint8) * 255).resize((w0, h0)).save('cliente/silueta-isotipo.png')

    perfil = ''.join(a_bezier([(x, y) for x, y in t], dec=2) for t in finales)
    dibujo = ('  <path fill="%s" d="%s"/>\n' % (BLANCO, trazar(gato, E)) +
              '  <path fill="%s" d="%s"/>\n' % (AZUL, trazar(perro, E)) +
              '  <path fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" d="%s"/>\n' % (AZUL, GROSOR, perfil))
    texto = ('  <path fill="%s" d="%s"/>\n' % (TEXTO, trazar(medio, E, 10)) +
             '  <path fill="%s" d="%s"/>\n' % (MARINO, trazar(marino, E, 10)))
    cab = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">\n'
           '  <!-- vectorizado desde el JPG de su Facebook (664×549): REVISAR contra el original -->\n') % (w0, h0)
    open('cliente/logo-vector.svg', 'w', encoding='utf-8').write(cab + dibujo + texto + '</svg>\n')
    open('cliente/isotipo-vector.svg', 'w', encoding='utf-8').write(
        cab + '  <path data-silueta fill="none" d="%s"/>\n' % trazar(sil, E) + dibujo + '</svg>\n')
    print('✓ cliente/logo-vector.svg y cliente/isotipo-vector.svg')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
