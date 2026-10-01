/* Utilidades de SVG sin dependencias: lo justo para meter el logo de un
   cliente en un sprite sin que choque con nada. Para limpiar y recortar un SVG
   «sucio» de verdad está scripts/logo.mjs, que usa el navegador. */

import { hexARgb, luminancia } from './color.mjs';

export function leerViewBox(src) {
  const svg = (src.match(/<svg\b[^>]*>/i) || [''])[0];
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vb) {
    const n = vb[1].trim().split(/[\s,]+/).map(Number);
    if (n.length === 4 && n.every(Number.isFinite)) return n;
  }
  const w = parseFloat((svg.match(/\bwidth\s*=\s*["']([\d.]+)/i) || [])[1]);
  const h = parseFloat((svg.match(/\bheight\s*=\s*["']([\d.]+)/i) || [])[1]);
  if (w && h) return [0, 0, w, h];
  throw new Error('El SVG no tiene viewBox ni width/height: pásalo por scripts/logo.mjs');
}

/* contenido de dentro del <svg>, sin prólogo, comentarios, metadatos ni <title> */
export function interior(src) {
  let s = src
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<title[\s\S]*?<\/title>/gi, '')
    .replace(/<desc[\s\S]*?<\/desc>/gi, '')
    .replace(/<sodipodi:[\s\S]*?(\/>|<\/sodipodi:[^>]+>)/gi, '');
  const ini = s.search(/<svg\b/i);
  const finApertura = s.indexOf('>', ini);
  const cierre = s.lastIndexOf('</svg>');
  if (ini < 0 || cierre < 0) throw new Error('No parece un SVG');
  return s.slice(finApertura + 1, cierre)
    .replace(/\s(inkscape|sodipodi|xmlns:[a-z]+)[:=][^\s>]*("[^"]*")?/gi, '')
    .trim();
}

/* ids únicos por marca: dos logos con un «clip0» cada uno se pisarían en el sprite */
export function prefijarIds(contenido, prefijo) {
  const ids = [...contenido.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
  let s = contenido;
  for (const id of ids) {
    const nuevo = prefijo + '-' + id;
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp('(\\bid\\s*=\\s*["\'])' + esc + '(["\'])', 'g'), '$1' + nuevo + '$2')
      .replace(new RegExp('url\\(\\s*#' + esc + '\\s*\\)', 'g'), 'url(#' + nuevo + ')')
      .replace(new RegExp('((?:xlink:)?href\\s*=\\s*["\'])#' + esc + '(["\'])', 'g'), '$1#' + nuevo + '$2');
  }
  return s;
}

const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const esCasiBlanco = c => COLOR_RE.test(c) && luminancia(c) > 0.85;

/* versión de una tinta: todo lo que tenga color pasa a currentColor; lo casi
   blanco (huecos pintados en blanco) se quita, porque en una tinta sería un
   borrón del mismo color. Ver RESKIN.md si el logo pierde detalle. */
export function monocromo(contenido) {
  const cambiar = v => {
    const c = v.trim();
    if (/^(none|transparent|currentColor|inherit)$/i.test(c) || /^url\(/i.test(c)) return c;
    if (esCasiBlanco(c) || /^(white|#fff(fff)?)$/i.test(c)) return 'none';
    return 'currentColor';
  };
  return contenido
    .replace(/\b(fill|stroke|stop-color)\s*=\s*"([^"]*)"/g, (m, a, v) => `${a}="${cambiar(v)}"`)
    .replace(/\b(fill|stroke|stop-color)\s*:\s*([^;"]+)/g, (m, a, v) => `${a}:${cambiar(v)}`);
}

/* colores usados, para el informe y para marca-desde-logo */
export function coloresUsados(contenido) {
  const set = new Set();
  for (const m of contenido.matchAll(/(?:fill|stroke|stop-color)\s*[=:]\s*"?\s*(#[0-9a-f]{3,6})\b/gi)) {
    try { hexARgb(m[1]); set.add(m[1].toUpperCase()); } catch (e) { /* no es un color */ }
  }
  return [...set];
}

/* La silueta es el primer <path data-silueta>. Si no lo hay, el primer path. */
export function silueta(contenido) {
  const conMarca = contenido.match(/<path\b[^>]*\bdata-silueta\b[^>]*>/i);
  const etiqueta = conMarca ? conMarca[0] : (contenido.match(/<path\b[^>]*>/i) || [])[0];
  if (!etiqueta) return null;
  const d = (etiqueta.match(/\sd\s*=\s*"([^"]+)"/) || [])[1];
  const t = (etiqueta.match(/\stransform\s*=\s*"([^"]+)"/) || [])[1];
  if (t) throw new Error('La silueta del isotipo lleva transform: aplánalo con scripts/logo.mjs');
  return d || null;
}

/* los detalles para la cortina: el resto de paths, sin transform */
export function detalles(contenido) {
  const out = [];
  for (const m of contenido.matchAll(/<path\b([^>]*)>/gi)) {
    if (/\bdata-silueta\b/.test(m[1])) continue;
    if (/\stransform\s*=/.test(m[1])) continue;
    const d = (m[1].match(/\sd\s*=\s*"([^"]+)"/) || [])[1];
    if (d) out.push(d);
  }
  return out;
}

/* Isotipo de reserva cuando el cliente solo tiene logotipo tipográfico:
   un círculo con la inicial en la letra de titulares de la pareja. */
export function monograma(inicial, color, sobreColor) {
  const d = 'M50 2A48 48 0 1 1 50 98A48 48 0 1 1 50 2Z';
  const letra = String(inicial).toUpperCase();
  /* la letra usa la tipografía de titulares de la marca por custom property:
     así cambia con la pareja sin volver a generar el SVG */
  const texto = (relleno) => `<text x="50" y="50" dy="0.36em" text-anchor="middle" font-size="54" style="font-family: var(--f-display); font-weight: var(--peso-display)" fill="${relleno}">${letra}</text>`;
  return {
    vb: [0, 0, 100, 100],
    silueta: d,
    detalles: [],
    original: `<path data-silueta d="${d}" fill="${color}"/>${texto(sobreColor)}`,
    mono: `<path d="M50 5A45 45 0 1 1 50 95A45 45 0 1 1 50 5Z" fill="none" stroke="currentColor" stroke-width="6"/>${texto('currentColor')}`
  };
}

export const vbTexto = vb => vb.map(n => +(+n).toFixed(3)).join(' ');
