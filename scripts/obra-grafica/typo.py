"""Texto -> pathops.Path con shaping real (HarfBuzz: kerning y ligaduras)."""
import os

import geo  # noqa: F401  (anade pylib al path)
import pathops
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.transformPen import TransformPen

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
_cache = {}


def _load(fname, axes):
    key = (fname, tuple(sorted((axes or {}).items())))
    if key in _cache:
        return _cache[key]
    path = os.path.join(FONTS, fname)
    tt = TTFont(path)
    if axes and "fvar" in tt:
        tt = instantiateVariableFont(tt, axes)
    face = hb.Face(hb.Blob.from_file_path(path))
    f = hb.Font(face)
    if axes:
        f.set_variations(axes)
    _cache[key] = (tt, f)
    return tt, f


def text_path(fname, text, size=100, axes=None, tracking=0.0, features=None):
    """Devuelve (Path, avance, metricas) con la linea base en y=0 y y hacia abajo.
    tracking en em (0.1 = 10 % del cuerpo entre letras)."""
    tt, f = _load(fname, axes)
    upm = tt["head"].unitsPerEm
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(f, buf, features or {"kern": True, "liga": True})
    order = tt.getGlyphOrder()
    gs = tt.getGlyphSet()
    k = size / upm
    out = pathops.Path()
    pen = out.getPen(glyphSet=gs)
    x = 0.0
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        g = order[info.codepoint]
        tp = TransformPen(pen, (k, 0, 0, -k, (x + pos.x_offset) * k, -pos.y_offset * k))
        gs[g].draw(tp)
        x += pos.x_advance + (tracking * upm if i < n - 1 else 0)
    out.simplify()
    os2 = tt["OS/2"]
    met = {
        "cap": getattr(os2, "sCapHeight", 0) * k,
        "xh": getattr(os2, "sxHeight", 0) * k,
        "asc": tt["hhea"].ascent * k,
        "desc": -tt["hhea"].descent * k,
    }
    return out, x * k, met
