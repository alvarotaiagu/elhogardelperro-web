# Reskin: pasar la plantilla a una clínica real

Receta para cuando llegue «pásala a la marca de X con este logo». Todo el cambio
es **rellenar dos archivos, soltar el logo y ejecutar un script**. No se toca
HTML, CSS ni JS a mano: si hace falta, el reskin ha dejado de serlo (§10).

Tiempo orientativo: 20–40 min con los datos a mano. El script `aplicar.mjs`
tarda unos segundos.

---

## 1. Duplicar la carpeta

```bash
cp -r plantilla-veterinaria-web <slug-del-cliente>-web
cd <slug-del-cliente>-web
rm -rf screenshots _scratch
```

`marca/pruebas/` se queda: el mando «Con otro logo» sirve en la reunión. Se
borra sola al quitar los mandos (§8).

## 2. Logo

```bash
node scripts/logo.mjs ruta/al/logo.svg                        # o .png / .jpg
node scripts/logo.mjs ruta/al/logo.svg --isotipo ruta/simbolo.svg
```

Deja en `marca/`: `logo.svg` limpio y ajustado, `logo-mono.svg` (una tinta),
`isotipo.svg` si se pasó, y `_logo.png` para sacar los colores.

Revisar a ojo, siempre:

- **Logo en PNG/JPG** → se vectoriza con potrace. Compáralo con el original. Si
  el cliente tiene el SVG o el PDF de la imprenta, mejor eso.
- **La silueta del isotipo** (`<path data-silueta>`): tiene que ser la forma
  **exterior, maciza y sin agujeros**. Es la ventana de la foto del hero y el
  hueco de la cortina. `logo.mjs` marca el path más largo y avisa. Si no es la
  forma buena, dibuja la silueta a mano como primer `<path data-silueta>` del
  isotipo.
- **Logo solo tipográfico, sin símbolo** → no pases `--isotipo`. La web hace un
  **monograma**: círculo con la inicial en la letra de titulares. Se cambia la
  letra con `"nombre_inicial": "A"` en `marca.json`.
- **`logo-mono.svg`**: los blancos del logo se quitan (en una tinta serían un
  borrón). Si el logo pierde un detalle importante (un ojo, una letra calada),
  dibuja la versión a una tinta a mano o pon `"logo_en_oscuro": "original"`.

## 3. Colores, letra y personalidad

```bash
python scripts/marca-desde-logo.py --personalidad cercana     # cercana | clinica | moderna
python scripts/marca-desde-logo.py --pareja serif-calida      # si la propuesta no encaja
python scripts/marca-desde-logo.py --solo-ver                 # proponer sin escribir
```

`marca/marca.json` queda así:

| Campo | Valores | Para qué |
|---|---|---|
| `slug` | `a-z0-9-` | Ids del sprite y claves de localStorage. **Cámbialo** al del cliente |
| `personalidad` | `cercana` · `clinica` · `moderna` | Radios, sombras, curva del movimiento, rótulos |
| `pareja` | `redondeada` · `serif-calida` · `grotesca-clinica` · `geometrica-moderna` · `humanista-seria` | Tipografía de titulares + texto (ver `scripts/parejas.json`) |
| `colores` | `fondo`, `superficie`, `tinta`, `acento`, `acento2` | Los cinco colores. El resto se deriva y se mide |
| `logo_en_oscuro` | `mono` · `original` | Qué logo va sobre la banda oscura y el pie |
| `densidad` | `marca` · `sobria` | La versión que se publica (§8) |
| `duotono` | `true` · `false` | Fotos a dos tintas con los colores de marca |
| `forma_hero` | `isotipo` · `circulo` · `arco` | Forma de la ventana del hero (§6) |
| `isotipo` | *(vacío)* · `monograma` | Fuerza el monograma aunque haya isotipo |

Reglas de color que no se negocian:

- **El color del logo no se toca.** Si el acento no llega a 4,5:1 como texto,
  `aplicar.mjs` deriva `--acento-texto` y, si hace falta, un `--boton` aparte.
  El acento puro se queda en lo decorativo.
- **Fondo oscuro** (`moderna`): si el acento del logo es oscuro, el script
  propone usar el segundo color del logo. Si el logo no tiene otro color, lo
  aclara solo para la web. Díselo al cliente.
- Si el logo es negro sobre blanco, el script **propone** un acento y lo dice.
  Es una propuesta: confírmala con el cliente o usa el color de su fachada o
  sus uniformes.

## 4. Datos del negocio: `negocio.json`

| Campo | Obligatorio | Si falta |
|---|---|---|
| `nombre`, `nombre_corto`, `lema`, `entradilla` | sí | `aplicar.mjs` se niega. `nombre_corto` es el titular gigante del hero |
| `direccion.*`, `telefono`, `email` | sí | se niega |
| `horario` | sí | una lista por día; `[]` si cierra. Turnos partidos: `[["09:30","14:00"],["16:30","20:30"]]` |
| `cierres` | no | festivos y vacaciones: `{"desde":"2026-08-10","hasta":"2026-08-24","motivo":"Vacaciones"}` |
| `especies` | sí | de `perro`, `gato`, `conejo`, `huron`, `ave`, `reptil`, `roedor` |
| `servicios` | sí (≥2) | `activo:false` los oculta sin borrarlos. Todos pesan lo mismo |
| `urgencias.modo` | no | `24h` · `telefono` · `ninguno`. **Nunca `24h` sin confirmarlo**: es la promesa que más cara sale |
| `whatsapp` | no | `{"numero":"…","confirmado":true}`. Sin `confirmado:true` no se enseña |
| `cita.via` | no | `whatsapp` · `telefono` · `enlace` (+ `cita.enlace`) |
| `equipo` | no | sin fotos salen medallones con iniciales. **Nunca caras de stock sobre nombres reales** |
| `instalaciones` | no | solo salen las fotos que existen en `media/`; sin ninguna, el módulo se quita |
| `resenas` | no | `nota`, `recuento`, `plataforma`, `enlace`, `citas`. **Por debajo de 20 no se enseña el recuento** |
| `preguntas` | no | nada de salud: formas de pago, aparcamiento, exóticos, domicilio |
| `legal.titular`, `legal.nif` | sí | aviso legal y privacidad |
| `modulos` | no | `marquee`, `urgencias`, `primera_visita`, `equipo`, `instalaciones`, `resenas`, `preguntas` |
| `demo` | — | **`false` en un cliente real**: quita el sello de demostración |
| `indexar` | — | `false` hasta que el cliente pague (memoria «noindex en todo») |
| `url` | — | la dirección publicada. Sirve para la og:image y la 404 bajo prefijo |

**Datos que no tenemos:** en un cliente real se escribe `[PENDIENTE]` y se
apunta en el README del cliente. **Nunca se inventa**: ni horario, ni equipo,
ni reseñas, ni número de colegiado. Una demo (`demo: true`) sí inventa todo, y
por eso lleva el sello.

**Reseñas reales:** solo citas textuales, con nombre de pila y con permiso.
Nada de parafrasear.

## 5. Fotos

Con nombre fijo en `media/`. Todas son opcionales: la web se sostiene sin
ninguna.

| Archivo | Qué | Tamaño |
|---|---|---|
| `hero.jpg` (+ `hero-800.jpg`) | la foto de la ventana del hero: un animal con la cara centrada | 1600 px en el lado largo |
| `instalaciones-1.jpg` … (+ `-800`) | consulta, sala de espera, equipos | 1600 px de ancho |
| `equipo/<nombre-en-slug>.jpg` | retrato cuadrado (p. ej. `equipo/uxia-barreiro-mato.jpg`) | 640 × 640 |

Sin foto de hero, la ventana se rellena con el acento y las siluetas de
especies. Con `duotono: true` las fotos de cualquier origen casan con la marca.
Las fotos de Google o de clientes **no** se publican sin permiso.

Redimensionar:

```bash
python -c "from PIL import Image; im=Image.open('orig.jpg'); im.thumbnail((1600,1600)); im.save('media/hero.jpg', quality=82, optimize=True); im.thumbnail((800,800)); im.save('media/hero-800.jpg', quality=80, optimize=True)"
```

## 6. Cuando el isotipo no sirve de ventana

Si el isotipo es muy fino (un trazo), muy alargado o tiene huecos, la foto del
hero queda rara. Pon `"forma_hero": "circulo"` o `"arco"` en `marca.json`: la
cortina sigue dibujando el isotipo, pero la ventana y el hueco usan esa forma.

## 7. Aplicar y verificar

```bash
node scripts/aplicar.mjs                  # escribe la web; se niega si falta algo o falla un contraste
node scripts/verificar.mjs --capturas     # todo; mira las capturas de screenshots/
node scripts/servir.mjs                   # http://127.0.0.1:4191/?revision
```

`aplicar.mjs` imprime la tabla de contraste y la deja en
`marca/_contraste.txt`. Si algo sale ✗, **no se fuerza**: se ajusta el color de
fondo o de superficie, nunca el del logo.

Mira las capturas: el hero a 360×640, la pila de servicios y el pie. Una
captura que se ve mal es un reskin sin terminar.

## 8. Antes de entregar: la versión elegida y fuera los mandos

1. En la reunión, con `?revision`, el cliente elige versión y color.
2. Fija lo que eligió:
   - Versión sobria → `"densidad": "sobria"` en `marca.json`.
   - Paleta alternativa → `node scripts/aplicar.mjs --fijar-paleta b` (o `c`).
3. Quita los mandos:
   ```bash
   python scripts/quitar_mandos.py --comprobar   # lo prueba en una copia
   python scripts/quitar_mandos.py               # lo hace y regenera
   node scripts/aplicar.mjs                      # con la og:image
   node scripts/verificar.mjs --rapido
   ```

## 9. Publicar

- `url` en `negocio.json` con la dirección definitiva, y volver a aplicar.
- `indexar: false` hasta que el cliente pague.
- GitHub Pages cachea 10 minutos. El CSS y el JS van versionados con `?v=`,
  pero avisa al cliente de que pulse Ctrl+F5 si ve una mezcla.

---

## Qué NO se cambia en un reskin (ya lo resuelve la plantilla)

- La estructura de secciones y su orden.
- El movimiento: la cortina con el isotipo, la ventana del hero, la pila, la
  cinta, el cursor y los imanes.
- La accesibilidad, las cookies, el mapa bajo clic, el menú móvil y la 404.
- El contraste: se deriva y se mide solo.
- Los textos de las secciones fijas («Así es venir por primera vez», «Lo que
  nos preguntáis antes de venir»…). Si un cliente quiere otro tono, se cambian
  en `fuente/index.html`, pero eso ya es una edición, no un reskin.

## Cuándo un reskin deja de ser reskin (§10)

Avisa antes de empezar, porque son horas, no minutos:

- El cliente pide **otra estructura**: más páginas, una tienda, reservas en
  línea con agenda propia o un blog.
- Su marca pide **un motivo que no es el isotipo**: una fachada muy
  reconocible o un personaje. Entonces toca una web a medida (como Gran Vía),
  no esta plantilla.
- **El logo es malo** y hay que redibujarlo. Se hace aparte, con su
  presupuesto, y luego se vuelve a este flujo.
- Quiere un **idioma más** (gallego + castellano). La plantilla no lo trae:
  hay que duplicar `fuente/` por idioma. Mira cómo lo resolvió Espazo
  Bilitroque.

## Problemas conocidos

- La og:image necesita Playwright. Si `aplicar.mjs` no lo encuentra, avisa y
  sigue: define `PLAYWRIGHT_MJS` con la ruta a `playwright/index.mjs`.
- La cortina y el hero usan `clip-path: url(#…)` sobre HTML. Funciona en
  Chrome, Firefox y Safari actuales. En un navegador viejo se ve la foto en
  rectángulo, no rota.
