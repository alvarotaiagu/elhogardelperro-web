/* og.mjs — la imagen de 1200×630 para redes, hecha con la propia marca:
   logo, lema, la foto del hero dentro del isotipo y los colores de marca.css.
   La llama aplicar.mjs; también se puede ejecutar sola: node scripts/og.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RUTA_PLAYWRIGHT = 'file:///C:/Users/alvar/Desktop/WEBS%20NEGOCIOS/alvarotaiagu.github.io/node_modules/playwright/index.mjs';

export async function cargarPlaywright() {
  const candidatos = [process.env.PLAYWRIGHT_MJS, RUTA_PLAYWRIGHT, 'playwright'].filter(Boolean);
  for (const c of candidatos) {
    try { return await import(c); } catch (e) { /* siguiente */ }
  }
  throw new Error('No encuentro Playwright (define PLAYWRIGHT_MJS con la ruta a playwright/index.mjs)');
}

export async function generarOg(raiz) {
  const { chromium } = await cargarPlaywright();
  const index = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const ini = index.indexOf('<svg class="sprite"');
  const fin = index.indexOf('<div class="cortina"');
  const sprite = ini >= 0 && fin > ini ? index.slice(ini, index.lastIndexOf('</svg>', fin) + 6) : '';
  const fuentes = (index.match(/<link rel="stylesheet" id="fuentes" href="([^"]+)"/) || [])[1];
  const attrs = (index.match(/<html [^>]+>/) || ['<html>'])[0];
  const slug = (attrs.match(/data-marca="([^"]+)"/) || [])[1];
  const lema = (index.match(/<p class="hero__lema">([^<]+)<\/p>/) || [])[1] || '';
  const vbLogo = (index.match(/class="logo__original" viewBox="([^"]+)"/) || [])[1];
  const vbVentana = (index.match(/id="ventana-contorno" viewBox="([^"]+)"/) || [])[1] || '0 0 100 100';
  const datos = (index.match(/<h2>Dónde<\/h2>\s*<p>([\s\S]*?)<\/p>/) || [])[1] || '';
  const hayFoto = fs.existsSync(path.join(raiz, 'media/hero.jpg'));
  const [, , vw, vh] = vbVentana.split(/\s+/).map(Number);
  const altoV = 470, anchoV = Math.round(altoV * vw / vh);

  const htmlOg = `<!DOCTYPE html>${attrs}<head><meta charset="utf-8">
<link rel="stylesheet" href="${fuentes}"><link rel="stylesheet" href="../css/marca.css"><link rel="stylesheet" href="../css/base.css">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  .og { position: relative; width: 1200px; height: 630px; display: grid; grid-template-columns: 1fr ${anchoV}px; align-items: center; gap: 56px; padding: 0 80px; box-sizing: border-box; background: var(--fondo); color: var(--tinta); }
  .og__logo svg { height: 92px; width: auto; aspect-ratio: var(--logo-aspecto); max-width: 560px; display: block; }
  .og__lema { margin: 44px 0 0; font: var(--peso-display) calc(52px * var(--escala-display))/1.08 var(--f-display); letter-spacing: var(--tracking-display); max-width: 15ch; }
  .og__datos { margin: 28px 0 0; font: 500 21px/1.4 var(--f-texto); color: var(--apagado); }
  .og__ventana { position: relative; width: ${anchoV}px; height: ${altoV}px; }
  .og__ventana .ventana { position: absolute; inset: 0; }
  .og__ventana img { width: 100%; height: 100%; object-fit: cover; }
  .og__barra { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: var(--acento); }
</style></head><body>
${sprite}
<div class="og">
  <div>
    <div class="og__logo logo"><svg class="logo__original" viewBox="${vbLogo}"><use href="#logo-${slug}"/></svg></div>
    <p class="og__lema">${lema}</p>
    <p class="og__datos">${datos.replace(/<br>/g, ' · ')}</p>
  </div>
  <div class="og__ventana">
    <div class="ventana foto" style="clip-path: url(#ventana-caja-${slug})">
      ${hayFoto ? '<img src="../media/hero.jpg" alt="">' : '<div class="ventana__trama"></div>'}
    </div>
  </div>
  <div class="og__barra"></div>
</div></body></html>`;

  const tmp = path.join(raiz, 'assets', '_og.html');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, htmlOg);
  const nav = await chromium.launch();
  try {
    const p = await nav.newPage({ viewport: { width: 1200, height: 630 } });
    await p.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(raiz, 'assets', 'og.jpg'), type: 'jpeg', quality: 86 });
  } finally {
    await nav.close();
    fs.rmSync(tmp, { force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  generarOg(raiz).then(() => console.log('✓ assets/og.jpg'), e => { console.error(e); process.exit(1); });
}
