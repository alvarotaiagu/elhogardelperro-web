/* Color: parseo, mezcla, contraste WCAG y OKLCH.
   Todo se calcula aquí, en el script, y se escribe como hex en css/marca.css:
   así el contraste se audita contra el valor real y no contra un color-mix
   que la herramienta no sabe leer (memoria «acento del cliente y contraste»). */

export function hexARgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('Color no válido: ' + hex);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export function rgbAHex([r, g, b]) {
  const c = v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

/* mezcla en sRGB: p = proporción de b (0 → a, 1 → b), igual que color-mix */
export function mezclar(a, b, p) {
  const A = hexARgb(a), B = hexARgb(b);
  return rgbAHex(A.map((v, i) => v + (B[i] - v) * p));
}

const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const delin = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function luminancia(hex) {
  const [r, g, b] = hexARgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const esOscuro = hex => luminancia(hex) < 0.18;

/* ── OKLCH ── */
export function hexAOklch(hex) {
  const [r, g, b] = hexARgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.hypot(A, B);
  let H = Math.atan2(B, A) * 180 / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function oklchARgbLineal({ L, C, H }) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ];
}

/* fuera de gama se baja el croma, no se recorta canal a canal (cambiaría el matiz) */
export function oklchAHex({ L, C, H }) {
  let c = C;
  for (let i = 0; i < 40; i++) {
    const rgb = oklchARgbLineal({ L, C: c, H });
    if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) return rgbAHex(rgb.map(v => delin(Math.min(1, Math.max(0, v)))));
    c *= 0.93;
  }
  return rgbAHex(oklchARgbLineal({ L, C: 0, H }).map(v => delin(Math.min(1, Math.max(0, v)))));
}

/* Acerca `color` hacia `hacia` lo justo para llegar a `objetivo` contra TODOS
   los fondos dados. Devuelve el propio color si ya llega. */
export function empujarHastaContraste(color, hacia, fondos, objetivo = 4.6) {
  const pasa = c => fondos.every(f => contraste(c, f) >= objetivo);
  if (pasa(color)) return color;
  for (let p = 0.02; p <= 1.0001; p += 0.02) {
    const c = mezclar(color, hacia, p);
    if (pasa(c)) return c;
  }
  return hacia;
}

/* El más apagado posible de `tinta` hacia `fondo` que aún da `objetivo`. */
export function apagadoMaximo(tinta, fondos, objetivo = 4.6) {
  let mejor = tinta;
  for (let p = 0.02; p <= 0.8; p += 0.02) {
    const c = mezclar(tinta, fondos[0], p);
    if (fondos.every(f => contraste(c, f) >= objetivo)) mejor = c; else break;
  }
  return mejor;
}

/* De cuantos candidatos, el que más contraste da sobre `fondo`. */
export function mejorSobre(fondo, candidatos) {
  return candidatos.slice().sort((a, b) => contraste(b, fondo) - contraste(a, fondo))[0];
}

/* ─────────────────────────────────────────────────────────────────────────
   Tokens a partir de los cinco colores de marca.json.
   Devuelve { tokens, informe }: tokens = { '--nombre': '#HEX' }, informe = filas
   de contraste para imprimir y para que el test las compruebe.
   ───────────────────────────────────────────────────────────────────────── */
export function derivarTokens(col) {
  const fondo = col.fondo, superficie = col.superficie, tinta = col.tinta;
  const acento = col.acento, acento2 = col.acento2 || col.acento;
  const oscuro = esOscuro(fondo);
  const NEGRO = '#000000', BLANCO = '#FFFFFF';

  const t = {};
  t['--fondo'] = fondo;
  t['--superficie'] = superficie;
  t['--superficie-2'] = mezclar(superficie, tinta, oscuro ? 0.08 : 0.05);
  t['--tinta'] = tinta;
  t['--apagado'] = apagadoMaximo(tinta, [fondo, superficie]);
  t['--linea'] = mezclar(fondo, tinta, 0.16);
  t['--linea-fuerte'] = mezclar(fondo, tinta, 0.34);
  t['--acento'] = acento;
  t['--acento-2'] = acento2;
  t['--acento-texto'] = empujarHastaContraste(acento, tinta, [fondo, superficie]);

  /* botón: el acento de marca si su texto llega a 4,5; si no, un tono aparte
     solo para el botón (la marca se queda donde es decorativa) */
  const sobreAcento = mejorSobre(acento, [BLANCO, tinta, fondo, NEGRO]);
  if (contraste(sobreAcento, acento) >= 4.5) {
    t['--boton'] = acento;
    t['--sobre-boton'] = sobreAcento;
  } else {
    const aOscuro = empujarHastaContraste(acento, NEGRO, [BLANCO], 4.6);
    const aClaro = empujarHastaContraste(acento, BLANCO, [tinta], 4.6);
    const oscuroGana = contraste(aOscuro, acento) <= contraste(aClaro, acento);
    t['--boton'] = oscuroGana ? aOscuro : aClaro;
    t['--sobre-boton'] = oscuroGana ? BLANCO : tinta;
  }
  t['--sobre-acento'] = sobreAcento;

  /* banda: las secciones de contraste */
  let banda;
  if (!oscuro) {
    banda = esOscuro(tinta) && luminancia(tinta) < 0.04 ? tinta : mezclar(tinta, NEGRO, 0.35);
  } else {
    banda = mezclar(fondo, acento, 0.1);
    if (!esOscuro(banda)) banda = mezclar(fondo, NEGRO, 0.3);
  }
  t['--banda'] = banda;
  const sobreBanda = oscuro ? tinta : fondo;
  t['--sobre-banda'] = contraste(sobreBanda, banda) >= 7 ? sobreBanda : mejorSobre(banda, [sobreBanda, BLANCO]);
  t['--apagado-banda'] = apagadoMaximo(t['--sobre-banda'], [banda]);
  t['--acento-banda'] = empujarHastaContraste(acento, t['--sobre-banda'], [banda]);
  t['--linea-banda'] = mezclar(banda, t['--sobre-banda'], 0.18);

  /* cortina: nunca del color de lo que destapa */
  t['--cortina'] = oscuro ? acento : banda;
  t['--sobre-cortina'] = oscuro ? sobreAcento : t['--acento-banda'];

  /* duotono de las fotos: luces y sombras con el color de la marca */
  const hA = hexAOklch(acento);
  t['--foto-luz'] = oklchAHex({ L: 0.93, C: Math.min(0.05, hA.C * 0.35), H: hA.H });
  t['--foto-sombra'] = oklchAHex({ L: 0.2, C: Math.min(0.06, hexAOklch(tinta).C + 0.02), H: hexAOklch(tinta).C > 0.02 ? hexAOklch(tinta).H : hA.H });

  t['--sombra-color'] = oscuro ? NEGRO : mezclar(tinta, NEGRO, 0.5);
  t['--foco'] = empujarHastaContraste(acento, oscuro ? BLANCO : tinta, [fondo, superficie], 3);

  const informe = [
    ['texto', '--tinta', '--fondo', 4.5],
    ['texto', '--tinta', '--superficie', 4.5],
    ['texto', '--apagado', '--fondo', 4.5],
    ['texto', '--apagado', '--superficie', 4.5],
    ['texto', '--acento-texto', '--fondo', 4.5],
    ['texto', '--acento-texto', '--superficie', 4.5],
    ['botón', '--sobre-boton', '--boton', 4.5],
    ['banda', '--sobre-banda', '--banda', 4.5],
    ['banda', '--apagado-banda', '--banda', 4.5],
    ['banda', '--acento-banda', '--banda', 4.5],
    ['cortina', '--sobre-cortina', '--cortina', 3],
    ['foco', '--foco', '--fondo', 3]
  ].map(([uso, a, b, min]) => ({ uso, texto: a, fondo: b, ratio: +contraste(t[a], t[b]).toFixed(2), min }));

  return { tokens: t, informe, oscuro };
}

/* Paletas B y C del mando: se gira el matiz del acento (y del acento 2)
   conservando luminosidad y croma. Tinta, fondo y superficie no cambian. */
export function paletaGirada(col, grados) {
  const girar = hex => {
    const o = hexAOklch(hex);
    if (o.C < 0.03) return hex;                 /* un gris no tiene matiz que girar */
    return oklchAHex({ L: o.L, C: o.C, H: (o.H + grados + 360) % 360 });
  };
  return { ...col, acento: girar(col.acento), acento2: girar(col.acento2 || col.acento) };
}
