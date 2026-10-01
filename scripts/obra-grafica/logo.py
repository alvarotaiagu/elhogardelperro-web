"""Composicion de logotipos horizontales a partir de paths."""
from geo import to_d, svg_doc, union
from typo import text_path


def tx(p, dx, dy, s=1.0):
    return p.transform(s, 0, 0, s, dx, dy)


def justified(fname, text, size, target_w, axes=None, t0=0.1):
    """Ajusta el tracking para que la tinta mida target_w."""
    t = t0
    for _ in range(8):
        p, adv, met = text_path(fname, text, size, axes, t)
        x0, _, x1, _ = p.bounds
        w = x1 - x0
        n = max(1, len(text) - 1)
        t += (target_w - w) / (size * n)
    p, adv, met = text_path(fname, text, size, axes, t)
    return p, t


def ink(p):
    return p.bounds


def build_doc(items, pad=0.0):
    """items: lista de (Path, fill, attrs). Normaliza a x=0,y=0 con la caja de todo."""
    b = [it[0].bounds for it in items]
    x0 = min(v[0] for v in b) - pad
    y0 = min(v[1] for v in b) - pad
    x1 = max(v[2] for v in b) + pad
    y1 = max(v[3] for v in b) + pad
    paths = [(to_d(tx(p, -x0, -y0)), f, a) for p, f, a in items]
    return svg_doc((0, 0, x1 - x0, y1 - y0), paths), (x1 - x0, y1 - y0)
