/* logo.mjs — prepara el logo que mande el cliente para la plantilla.

     node scripts/logo.mjs ruta/al/logo.svg
     node scripts/logo.mjs ruta/al/logo.png                  (se vectoriza con potrace)
     node scripts/logo.mjs logo.svg --isotipo simbolo.svg     (además el isotipo)
     node scripts/logo.mjs logo.svg --dir marca/pruebas/x     (otra carpeta de marca)

   Qué deja en marca/:
     logo.svg        limpio, viewBox ajustado a lo que se ve y con origen 0 0
     logo-mono.svg   a una tinta (currentColor) para fondos oscuros
     isotipo.svg     si se pasa --isotipo; el path más grande se marca data-silueta
     _logo.png       el logo rasterizado, para que marca-desde-logo.py pese colores

   Usa el navegador (Playwright) para medir la caja real del dibujo: los SVG que
   salen de Illustrator o Canva suelen traer márgenes enormes o viewBox raros. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright } from './og.mjs';
import { interior, monocromo, leerViewBox } from './lib/svg.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const entrada = args[0];
const dir = path.join(RAIZ, opt('--dir') || 'marca');
const entradaIso = opt('--isotipo');
if (!entrada || entrada.startsWith('--')) { console.error('Uso: node scripts/logo.mjs <logo.svg|png> [--isotipo simbolo.svg] [--dir marca]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });

function aSvg(ruta) {
  if (/\.svg$/i.test(ruta)) return fs.readFileSync(ruta, 'utf8');
  const tmp = path.join(dir, '_vectorizado.svg');
  execFileSync('python', [path.join(RAIZ, 'scripts/vectorizar.py'), ruta, tmp], { stdio: 'inherit' });
  const s = fs.readFileSync(tmp, 'utf8');
  fs.rmSync(tmp);
  console.log('! Logo vectorizado automáticamente: revísalo contra el original antes de entregar.');
  return s;
}

/* ── traslada un path (absoluto y relativo) sin transform: la silueta del
      isotipo no puede llevar transform (aplicar.mjs la usa como máscara) ── */
function trasladarD(d, dx, dy) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  const out = [];
  let cmd = null, i = 0, primero = true;
  const ARGS = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) { cmd = tokens[i++]; out.push(cmd); if (/z/i.test(cmd)) continue; }
    const n = ARGS[cmd.toLowerCase()];
    const nums = tokens.slice(i, i + n).map(Number); i += n;
    const abs = cmd === cmd.toUpperCase() || (primero && cmd === 'm' && out.length === 1);
    if (abs) {
      const C = cmd.toUpperCase();
      if (C === 'H') nums[0] += dx;
      else if (C === 'V') nums[0] += dy;
      else if (C === 'A') { nums[5] += dx; nums[6] += dy; }
      else for (let k = 0; k < nums.length; k += 2) { nums[k] += dx; nums[k + 1] += dy; }
    }
    primero = false;
    out.push(nums.map(v => +v.toFixed(3)).join(' '));
  }
  return out.join(' ').replace(/ ([a-zA-Z])/g, '$1').replace(/([a-zA-Z]) /g, '$1');
}

function trasladarNivelSuperior(contenido, dx, dy) {
  /* paths de primer nivel sin transform: se reescribe la d; lo demás lleva un
     translate delante (los hijos de un <g> se mueven con su grupo) */
  let hondo = 0;
  return contenido.replace(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g, (m, cierre, tag, resto, auto) => {
    if (cierre) { hondo--; return m; }
    const nivel = hondo;
    if (!auto) hondo++;
    if (nivel !== 0 || /^(defs|clipPath|mask|linearGradient|radialGradient|style|title)$/i.test(tag)) return m;
    if (tag === 'path' && !/\stransform=/.test(resto)) {
      return '<' + tag + resto.replace(/\sd="([^"]+)"/, (x, d) => ` d="${trasladarD(d, dx, dy)}"`) + auto + '>';
    }
    if (/\stransform="/.test(resto)) return '<' + tag + resto.replace(/\stransform="([^"]*)"/, (x, t) => ` transform="translate(${dx} ${dy}) ${t}"`) + auto + '>';
    return '<' + tag + resto + ` transform="translate(${dx} ${dy})"` + auto + '>';
  });
}

async function normalizar(src, nav, nombre) {
  const vb = leerViewBox(src);
  const dentro = interior(src);
  const p = await nav.newPage();
  await p.setContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="800"><g id="todo">${dentro}</g></svg>`);
  const caja = await p.evaluate(() => {
    const g = document.getElementById('todo');
    const b = g.getBBox();
    let trazo = 0;
    g.querySelectorAll('*').forEach(n => { const s = parseFloat(getComputedStyle(n).strokeWidth) || 0; if (getComputedStyle(n).stroke !== 'none') trazo = Math.max(trazo, s); });
    return { x: b.x, y: b.y, w: b.width, h: b.height, trazo };
  });
  await p.close();
  const margen = Math.max(caja.trazo / 2, Math.max(caja.w, caja.h) * 0.01);
  const x = caja.x - margen, y = caja.y - margen, w = caja.w + 2 * margen, h = caja.h + 2 * margen;
  const movido = trasladarNivelSuperior(dentro, +(-x).toFixed(3), +(-y).toFixed(3));
  const fin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${+w.toFixed(3)} ${+h.toFixed(3)}">\n${movido}\n</svg>\n`;
  console.log(`✓ ${nombre}: viewBox ${vb.join(' ')} → 0 0 ${w.toFixed(1)} ${h.toFixed(1)}`);
  return fin;
}

function marcarSilueta(svg) {
  if (/data-silueta/.test(svg)) return svg;
  /* sin marca: el path de primer nivel con la d más larga es casi siempre el contorno */
  const paths = [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"[^>]*>/g)];
  if (!paths.length) { console.log('! El isotipo no tiene <path>: aplicar.mjs usará un monograma'); return svg; }
  const mayor = paths.sort((a, b) => b[1].length - a[1].length)[0][0];
  console.log('! Marcado como silueta el path más largo. REVÍSALO: tiene que ser la forma exterior maciza.');
  return svg.replace(mayor, mayor.replace('<path', '<path data-silueta'));
}

const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();
try {
  const logo = await normalizar(aSvg(entrada), nav, 'logo.svg');
  fs.writeFileSync(path.join(dir, 'logo.svg'), logo);
  fs.writeFileSync(path.join(dir, 'logo-mono.svg'), logo.replace(interior(logo), monocromo(interior(logo))));
  console.log('✓ logo-mono.svg (revisa que no pierda detalles: los blancos del logo se quitan)');

  if (entradaIso) {
    const iso = marcarSilueta(await normalizar(aSvg(entradaIso), nav, 'isotipo.svg'));
    fs.writeFileSync(path.join(dir, 'isotipo.svg'), iso);
  }

  const p = await nav.newPage({ viewport: { width: 900, height: 500 } });
  await p.setContent(`<body style="margin:0;background:transparent">${logo.replace('<svg ', '<svg width="800" ')}</body>`);
  await p.locator('svg').screenshot({ path: path.join(dir, '_logo.png'), omitBackground: true });
  console.log('✓ _logo.png (para marca-desde-logo.py)');
} finally {
  await nav.close();
}
console.log('\nSiguiente: python scripts/marca-desde-logo.py' + (opt('--dir') ? ' --dir ' + opt('--dir') : ''));
