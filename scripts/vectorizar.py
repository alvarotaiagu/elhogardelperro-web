"""vectorizar.py — logo en PNG/JPG → SVG por capas de color (potrace).

  python scripts/vectorizar.py entrada.png salida.svg [--colores 3]

Lo llama scripts/logo.mjs cuando el cliente solo tiene el logo en imagen.
Cuantiza a pocos colores, quita el fondo (el color de las esquinas) y traza
cada color como un <path> con fill-rule evenodd. El resultado se marca como
«vectorizado, revisar»: un trazado automático nunca sustituye al original.

Nota: potracer toma como FIGURA lo que vale False (invierte solo), así que se
le pasa la máscara negada.
"""
import argparse, sys
import numpy as np
from PIL import Image
import potrace

def trazar(mascara):
    curvas = potrace.Bitmap(~mascara).trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.2)
    partes = []
    for c in curvas:
        p = c.start_point
        d = ['M%.2f %.2f' % (p.x, p.y)]
        for s in c.segments:
            if s.is_corner:
                d.append('L%.2f %.2f L%.2f %.2f' % (s.c.x, s.c.y, s.end_point.x, s.end_point.y))
            else:
                d.append('C%.2f %.2f %.2f %.2f %.2f %.2f' % (s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.end_point.x, s.end_point.y))
        d.append('Z')
        partes.append(''.join(d))
    return ''.join(partes)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('entrada')
    ap.add_argument('salida')
    ap.add_argument('--colores', type=int, default=3, help='colores del logo SIN contar el fondo')
    a = ap.parse_args()

    im = Image.open(a.entrada).convert('RGBA')
    escala = 1600 / max(im.size) if max(im.size) < 1600 else 1
    if escala != 1:
        im = im.resize((round(im.width * escala), round(im.height * escala)), Image.LANCZOS)
    fondo_blanco = Image.new('RGBA', im.size, (255, 255, 255, 255))
    rgb = Image.alpha_composite(fondo_blanco, im).convert('RGB')
    q = rgb.quantize(colors=a.colores + 1, method=Image.Quantize.MEDIANCUT)
    idx = np.array(q)
    pal = q.getpalette()

    esquinas = [idx[0, 0], idx[0, -1], idx[-1, 0], idx[-1, -1]]
    fondo = max(set(esquinas), key=esquinas.count)
    alfa = np.array(im)[:, :, 3]

    capas = []
    for i in np.unique(idx):
        if i == fondo:
            continue
        mascara = (idx == i) & (alfa >= 128)
        area = int(mascara.sum())
        if area < 40:
            continue
        color = '#%02X%02X%02X' % tuple(pal[i * 3:i * 3 + 3])
        capas.append((area, color, trazar(mascara)))
    capas.sort(key=lambda x: -x[0])
    if not capas:
        sys.exit('No quedó nada que trazar: ¿el logo es del mismo color que el fondo?')

    h, w = idx.shape
    cuerpo = '\n'.join('  <path fill="%s" fill-rule="evenodd" d="%s"/>' % (c, d) for _, c, d in capas)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">\n'
           '  <!-- vectorizado automáticamente desde %s: REVISAR contra el original -->\n%s\n</svg>\n') % (w, h, a.entrada.replace('\\', '/').split('/')[-1], cuerpo)
    open(a.salida, 'w', encoding='utf-8').write(svg)
    print('✓ %s: %d capas de color %s' % (a.salida, len(capas), ', '.join(c for _, c, _ in capas)))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
