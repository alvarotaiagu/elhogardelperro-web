# Obra gráfica: cómo se generaron los SVG

Estos scripts generaron las siluetas de especies y los logos de la demo (Lontra) y de las marcas de prueba (Arxila, O Corzo). **No hacen falta para un reskin.** Un reskin usa el logo del cliente y pasa por `scripts/logo.mjs`. Se guardan para poder retocar una pieza en vez de redibujarla.

| Script | Qué hace |
|---|---|
| `species.py` | Las 7 siluetas de `ilustracion/especies/`: un path, misma familia de curvas, apoyadas en y=108 |
| `build_marcas.py <carpeta>` | Los logos y los isotipos de Lontra, Arxila y O Corzo |
| `geo.py` | Geometría booleana (unión, diferencia, cápsulas…) sobre `skia-pathops` |
| `typo.py`, `logo.py` | Texto a paths con HarfBuzz (kerning real) y montaje de los wordmarks |
| `check.py` | Comprueba las reglas duras: silueta primero, maciza, sin agujeros, proporción |
| `sheet_*.py`, `render.mjs` | Las hojas de contacto `_hoja.png` |

Dependencias: `pip install skia-pathops uharfbuzz fonttools`.

Las fuentes van en `scripts/obra-grafica/fonts/` y no están en el repo. Son todas OFL, de github.com/google/fonts:

- Young Serif y Rubik (Lontra)
- Archivo (Arxila)
- Jost (O Corzo)
