/* medir-parejas.mjs — mide cada pareja de scripts/parejas.json en el navegador
   y escribe dos números por pareja:
     escala → iguala el tamaño VISUAL de los titulares entre parejas (altura de x
              de la display respecto a la media). Así cambiar de pareja no mueve
              el layout: es el «size-adjust» de la plantilla.
     ancho  → avance medio por carácter, en em, ya con la escala aplicada. El
              titular del hero lo usa para no desbordar con nombres largos.
   Además comprueba que cada fuente trae € « » ñ y tildes (PLIEGO §6).

   node scripts/medir-parejas.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright } from './og.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ruta = path.join(RAIZ, 'scripts', 'parejas.json');
const parejas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const claves = Object.keys(parejas).filter(k => k[0] !== '_');
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();
const p = await nav.newPage();
const url = 'https://fonts.googleapis.com/css2?' + claves.flatMap(k => [parejas[k].display.google, parejas[k].texto.google]).map(g => 'family=' + g).join('&') + '&display=block';
await p.setContent(`<html><head><link rel="stylesheet" href="${url}"></head><body>${claves.map(k => `<span data-k="${k}" style="font-family:'${parejas[k].display.familia}';font-weight:${parejas[k].display.peso};font-size:100px;letter-spacing:${parejas[k].display.tracking}">Clínica veterinaria · 12 € «ñ»</span><span data-t="${k}" style="font-family:'${parejas[k].texto.familia}';font-size:100px">€ «ñ» áéíóú</span>`).join('<br>')}</body></html>`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const medidas = await p.evaluate(claves => claves.map(k => {
  const el = document.querySelector(`[data-k="${k}"]`);
  const cs = getComputedStyle(el);
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
  const x = c.measureText('x');
  const altoX = x.actualBoundingBoxAscent;
  const muestra = 'Clínica Veterinaria San Francisco';
  const anchoMuestra = c.measureText(muestra).width / 100 / muestra.length + parseFloat(cs.letterSpacing || 0) / 100;
  /* un glifo que falta cae a la de respaldo: con dos respaldos distintos mide distinto */
  const falta = (familia, peso) => [...'€«»ñÑáéíóú'].filter(g => {
    c.font = `${peso} 100px ${familia}, monospace`; const a = c.measureText(g).width;
    c.font = `${peso} 100px ${familia}, serif`; const b = c.measureText(g).width;
    return Math.abs(a - b) > 0.5;
  });
  const primera = f => f.split(',')[0];
  const cargadas = [falta(primera(cs.fontFamily), cs.fontWeight), falta(primera(getComputedStyle(document.querySelector(`[data-t="${k}"]`)).fontFamily), 400)];
  return { k, altoX, ancho: anchoMuestra, glifos: cargadas };
}), claves);
await nav.close();

const media = medidas.reduce((a, m) => a + m.altoX, 0) / medidas.length;
for (const m of medidas) {
  const escala = +(media / m.altoX).toFixed(3);
  parejas[m.k].escala = escala;
  parejas[m.k].ancho = +(m.ancho * escala).toFixed(3);
  console.log(`${m.k.padEnd(20)} x ${m.altoX.toFixed(1)}  escala ${escala}  ancho ${parejas[m.k].ancho}  glifos ${m.glifos.every(g => !g.length) ? 'ok' : 'FALTAN ' + m.glifos.map(g => g.join('')).join(' / ')}`);
}
fs.writeFileSync(ruta, JSON.stringify(parejas, null, 2) + '\n');
console.log('✓ scripts/parejas.json actualizado. Vuelve a ejecutar aplicar.mjs.');
