/* verificar.mjs — comprobación completa de la plantilla (PLIEGO §7 + checklist).
   No sabe nada de la marca concreta: lee negocio.json y marca/ para saber qué
   esperar, así que sirve igual después de un reskin.

     node scripts/verificar.mjs              todo
     node scripts/verificar.mjs --capturas   además guarda screenshots/
     node scripts/verificar.mjs --rapido     sin el test de reskin ni el de parejas
     node scripts/verificar.mjs --solo-reskin

   Con Lenis, window.scrollTo no dispara ScrollTrigger: se baja con la rueda. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright } from './og.mjs';
import { crearServidor } from './servir.mjs';
import { derivarTokens, paletaGirada, contraste } from './lib/color.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CAPTURAS = args.includes('--capturas');
const RAPIDO = args.includes('--rapido');
const SOLO_RESKIN = args.includes('--solo-reskin');
const leer = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const negocio = JSON.parse(leer(RAIZ, 'negocio.json'));
const marca = JSON.parse(leer(RAIZ, 'marca', 'marca.json'));
const parejas = JSON.parse(leer(RAIZ, 'scripts', 'parejas.json'));
const hayMando = leer(RAIZ, 'fuente', 'index.html').includes('[MANDO DE MAQUETA]');
if (CAPTURAS) fs.mkdirSync(path.join(RAIZ, 'screenshots'), { recursive: true });
const foto = n => path.join(RAIZ, 'screenshots', n);

const fallos = [], notas = [];
function comprobar(ok, mensaje) { (ok ? notas : fallos).push((ok ? 'OK   ' : 'FALLA') + ' · ' + mensaje); }
const espera = ms => new Promise(r => setTimeout(r, ms));

async function rueda(page, vueltas, paso = 600, pausa = 220) {
  for (let i = 0; i < vueltas; i++) { await page.mouse.wheel(0, paso); await page.waitForTimeout(pausa); }
  await page.waitForTimeout(1500);
}
async function hasta(page, selector, margen = 0) {
  for (let i = 0; i < 90; i++) {
    const top = await page.evaluate(s => { const n = document.querySelector(s); return n ? n.getBoundingClientRect().top : null; }, selector);
    if (top === null) return false;
    if (top <= 90 + margen && top > -40) break;
    const paso = top > 0 ? Math.min(700, Math.max(120, top - 60)) : Math.max(-700, top - 80);
    await page.mouse.wheel(0, paso);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  return true;
}

const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const claveCookies = marca.slug + '-cookies';

async function nuevaPagina(opciones = {}) {
  const contexto = await navegador.newContext({
    viewport: opciones.viewport || { width: 1440, height: 900 },
    reducedMotion: opciones.reducedMotion || 'no-preference',
    timezoneId: 'Europe/Madrid',
    deviceScaleFactor: 1
  });
  if (opciones.sinCookies) await contexto.addInitScript(k => { try { localStorage.setItem(k, 'ok'); } catch (e) {} }, opciones.claveCookies || claveCookies);
  const page = await contexto.newPage();
  const errores = [], caidas = [];
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('requestfailed', r => caidas.push(r.url() + ' → ' + (r.failure()?.errorText || '')));
  page.on('response', r => { if (r.status() >= 400) caidas.push(r.status() + ' ' + r.url()); });
  return { contexto, page, errores, caidas };
}
const ignorables = c => /favicon\.ico|google\.com\/maps|gstatic\.com\/maps|maps\.google|maps\.googleapis/.test(c);

/* ═════════════ 0. comprobaciones estáticas ═════════════ */
function estaticas() {
  const colorLiteral = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\blab\(/;
  const familias = [...new Set(Object.entries(parejas).filter(([k]) => k[0] !== '_').flatMap(([, p]) => [p.display.familia, p.texto.familia]))];
  const revisar = ['css/base.css', 'js/main.js', ...fs.readdirSync(path.join(RAIZ, 'fuente')).map(n => 'fuente/' + n)];
  const conColor = [], conFuente = [];
  for (const rel of revisar) {
    leer(RAIZ, rel).split(/\r?\n/).forEach((l, i) => {
      const sinUrl = l.replace(/url\(#[^)]*\)|href="#[^"]*"|#[a-z][\w-]*/gi, '');   /* #id no es un color */
      if (colorLiteral.test(sinUrl)) conColor.push(rel + ':' + (i + 1) + ' ' + l.trim().slice(0, 70));
      for (const f of familias) if (l.includes(f)) conFuente.push(rel + ':' + (i + 1) + ' ' + f);
    });
  }
  comprobar(!conColor.length, 'cero colores literales fuera de css/marca.css' + (conColor.length ? ' → ' + conColor.slice(0, 6).join(' | ') : ''));
  comprobar(!conFuente.length, 'cero fuentes nombradas fuera de css/marca.css' + (conFuente.length ? ' → ' + conFuente.join(' | ') : ''));

  const index = leer(RAIZ, 'index.html');
  if (!negocio.indexar) {
    const sinNoindex = ['index.html', 'aviso-legal.html', 'privacidad.html', '404.html'].filter(p => !/<meta name="robots" content="noindex, nofollow">/.test(leer(RAIZ, p)));
    comprobar(!sinNoindex.length, 'noindex en todas las páginas' + (sinNoindex.length ? ' → falta en ' + sinNoindex.join(', ') : ''));
  }
  comprobar(!/aggregateRating|"review"/.test(index), 'schema.org sin aggregateRating ni review');
  for (const f of ['favicon.svg', 'manifest.json', '.nojekyll', 'assets/og.jpg', '404.html'])
    comprobar(fs.existsSync(path.join(RAIZ, f)), 'existe ' + f);
  if (negocio.demo) {
    const sello = 'es un negocio ficticio';
    comprobar(index.includes('SITIO DE DEMOSTRACIÓN') && (index.match(new RegExp(sello, 'g')) || []).length >= 2 && leer(RAIZ, 'README.md').includes(sello),
      'sello de demo en comentario HTML, pie y README');
    const texto = index.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    comprobar(!/\[PENDIENTE/i.test(texto) && !/\bTODO\b/.test(texto) && !/lorem ipsum/i.test(texto), 'demo sin [PENDIENTE], TODO ni relleno');
  }
  const contr = leer(RAIZ, 'marca', '_contraste.txt');
  comprobar(!contr.split('\n').some(l => l.trim().startsWith('✗') && l.includes(marca.slug)) && !/✗/.test(contr.split('\n\n')[0]),
    'contraste AA de la marca principal (marca/_contraste.txt)');
  /* paletas B y C del mando: medidas, no a ojo */
  for (const [clave, grados] of [['B', 120], ['C', -120]]) {
    const inf = derivarTokens(paletaGirada(marca.colores, grados)).informe.filter(f => f.min >= 4.5 && f.ratio < f.min);
    comprobar(!inf.length, 'paleta ' + clave + ': contraste AA en texto y botón' + (inf.length ? ' → ' + inf.map(f => f.texto + '/' + f.fondo + ' ' + f.ratio).join(', ') : ''));
  }
  /* versionado: solo en atributos href/src (memoria «versionar.mjs») */
  const vers = [...index.matchAll(/\?v=[0-9a-f]{8}/g)].length;
  const enAtributos = [...index.matchAll(/(?:href|src)="[^"]+\?v=[0-9a-f]{8}"/g)].length;
  comprobar(vers >= 3 && vers === enAtributos + (index.match(/"hoja":"[^"]+\?v=/g) || []).length, 'CSS y JS versionados con ?v=<huella> solo en href/src');
  if (hayMando) {
    try {
      const salida = execFileSync('python', [path.join(RAIZ, 'scripts/quitar_mandos.py'), '--comprobar'], { encoding: 'utf8' });
      comprobar(/✓ La receta de borrado funciona/.test(salida), 'quitar_mandos.py comprobado contra una copia');
    } catch (e) { comprobar(false, 'quitar_mandos.py --comprobar falla → ' + (e.stdout || e.message).slice(-400)); }
  }
}

/* ═════════════ estado en vivo: casos fijos con el horario de ejemplo ═════════════ */
const HORARIO_PRUEBA = {
  zona: 'Europe/Madrid',
  horario: {
    lunes: [['09:30', '14:00'], ['16:30', '20:30']], martes: [['09:30', '14:00'], ['16:30', '20:30']],
    miercoles: [['09:30', '14:00'], ['16:30', '20:30']], jueves: [['09:30', '14:00'], ['16:30', '20:30']],
    viernes: [['09:30', '14:00'], ['16:30', '20:30']], sabado: [['10:00', '14:00']], domingo: []
  },
  cierres: [{ desde: '2026-10-12', hasta: '2026-10-12', motivo: 'Festivo nacional' }]
};
const CASOS = [
  ['2026-10-05T09:00:00+02:00', false, /abre a las 9:30/, 'L 9:00 → cerrado, abre a las 9:30'],
  ['2026-10-05T14:15:00+02:00', false, /abre a las 16:30/, 'L 14:15 → cerrado entre turnos, abre a las 16:30'],
  ['2026-10-10T13:59:00+02:00', true, /cierra a las 14:00/, 'S 13:59 → abierto'],
  ['2026-10-18T12:00:00+02:00', false, /abre mañana a las 9:30/, 'D → cerrado, abre mañana'],
  ['2026-10-11T12:00:00+02:00', false, /abre el martes a las 9:30/, 'D antes de un lunes festivo → abre el martes'],
  ['2026-10-12T11:00:00+02:00', false, /festivo/, 'festivo en lunes → cerrado aunque sea laborable'],
  ['2026-10-17T15:00:00+02:00', false, /abre el lunes a las 9:30/, 'S tarde → abre el lunes (salta el domingo)']
];

let prefijo = null;
try { prefijo = new URL(negocio.url).pathname; } catch (e) {}
const servidor = crearServidor(RAIZ, prefijo);   /* con el prefijo de Pages, como la 404 de verdad */
await new Promise(r => servidor.listen(4192, '127.0.0.1', r));
const base = 'http://127.0.0.1:4192';

try {
  if (!SOLO_RESKIN) {
    estaticas();

    /* ═════════════ 1. escritorio, pasada normal ═════════════ */
    {
      const { contexto, page, errores, caidas } = await nuevaPagina();
      const largas = [];
      await page.addInitScript(() => {
        window.__largas = [];
        try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__largas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
      });
      await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });

      /* fotogramas intermedios de la cortina: el isotipo trazándose y el hueco abriéndose */
      let trazando = false, abriendo = false;
      for (let i = 0; i < 70 && !abriendo; i++) {
        const e = await page.evaluate(() => {
          const c = document.getElementById('cortina');
          const t = document.querySelector('.cortina__trazo');
          const h = document.getElementById('cortina-hueco').getAttribute('transform') || '';
          return { visible: getComputedStyle(c).display !== 'none', dash: t ? parseFloat(getComputedStyle(t).strokeDashoffset) : 1, hueco: /translate/.test(h) };
        });
        if (e.visible && e.dash > 0.05 && e.dash < 0.95 && !trazando) { trazando = true; if (CAPTURAS) await page.screenshot({ path: foto('00a-cortina-trazo.png') }); }
        if (e.visible && e.hueco) { await page.waitForTimeout(450); abriendo = true; if (CAPTURAS) await page.screenshot({ path: foto('00b-cortina-abriendo.png') }); }
        await page.waitForTimeout(70);
      }
      comprobar(trazando, 'cortina: el isotipo se ve trazándose');
      comprobar(abriendo, 'cortina: la página aparece a través del isotipo antes de irse');
      const colorCortina = await page.evaluate(() => [getComputedStyle(document.querySelector('.cortina__telon')).fill, getComputedStyle(document.body).backgroundColor]);
      comprobar(colorCortina[0] !== colorCortina[1], 'cortina de otro color que el fondo que destapa → ' + colorCortina.join(' / '));
      await page.waitForTimeout(3200);
      comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display) === 'none', 'la cortina acaba en display:none');
      const desborda = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      comprobar(desborda <= 1, 'sin desbordamiento horizontal en escritorio (' + desborda + 'px)');
      const estadoDom = await page.evaluate(() => ({ attr: document.querySelector('[data-estado]').getAttribute('data-abierto'), texto: document.querySelector('[data-estado-texto]').textContent }));
      comprobar(!!estadoDom.attr && /Abierto|Cerrado/.test(estadoDom.texto), 'estado en vivo pintado → ' + estadoDom.texto);
      if (CAPTURAS) await page.screenshot({ path: foto('01-hero.png') });

      /* cursor propio (checklist 1) */
      await page.mouse.move(700, 300); await page.mouse.move(720, 330, { steps: 4 }); await page.waitForTimeout(400);
      const libre = await page.evaluate(() => ({ sistema: getComputedStyle(document.body).cursor, aro: getComputedStyle(document.querySelector('.cursor')).opacity, punto: getComputedStyle(document.querySelector('.cursor-punto')).opacity }));
      comprobar(libre.sistema === 'none' && libre.aro === '1' && libre.punto === '1', 'cursor propio visible (aro + punto) y el del sistema oculto → ' + JSON.stringify(libre));
      const cita = await page.locator('.hero__acciones .boton--cita').boundingBox();
      await page.mouse.move(cita.x + cita.width / 2, cita.y + cita.height / 2, { steps: 6 }); await page.waitForTimeout(700);
      const sobreCita = await page.evaluate(() => {
        const c = document.querySelector('.cursor');
        return { clase: c.className, iso: getComputedStyle(c.querySelector('.cursor__isotipo')).opacity, fondo: getComputedStyle(c).backgroundColor, sistema: getComputedStyle(document.querySelector('.hero__acciones .boton')).cursor };
      });
      const alfa = (/rgba?\(([^)]+)\)/.exec(sobreCita.fondo) || [, '0,0,0,0'])[1].split(',').map(Number);
      comprobar(/cursor--cita/.test(sobreCita.clase) && sobreCita.iso === '1' && (alfa.length === 3 || alfa[3] >= 0.35) && sobreCita.sistema === 'none',
        'sobre «pedir cita» el aro se rellena y enseña el isotipo → ' + JSON.stringify(sobreCita));
      if (CAPTURAS) await page.screenshot({ path: foto('01b-cursor-cita.png'), clip: { x: cita.x - 50, y: cita.y - 50, width: cita.width + 100, height: cita.height + 100 } });

      /* hero: la ventana crece con el scroll hasta llenar la pantalla */
      const viva = await page.evaluate(() => document.getElementById('inicio').classList.contains('hero--viva'));
      comprobar(viva, 'hero en modo vivo (la foto dentro del isotipo)');
      await rueda(page, 2, 350);
      if (CAPTURAS) await page.screenshot({ path: foto('02-hero-a-medias.png') });
      await rueda(page, 3, 400);
      const lleno = await page.evaluate(() => {
        /* el recorte se completa con un círculo que crece: lleno = radio ≥ media diagonal */
        const slug = document.documentElement.getAttribute('data-marca');
        const circ = document.querySelector('#ventana-viva-' + slug + ' circle');
        if (!circ || !document.querySelector('.hero__viva')) return null;
        return parseFloat(circ.getAttribute('r')) >= Math.hypot(window.innerWidth, window.innerHeight) / 2;
      });
      comprobar(lleno !== false, 'al bajar, la foto llena la pantalla' + (lleno === null ? ' (sin capa viva)' : ''));
      if (CAPTURAS) await page.screenshot({ path: foto('03-hero-lleno.png') });

      const secciones = ['#especies', '#servicios', '#urgencias', '#primera-visita', '#equipo', '#instalaciones', '#opiniones', '#preguntas', '#visita'];
      let n = 4;
      for (const s of secciones) {
        if (!(await hasta(page, s))) continue;
        if (CAPTURAS) await page.screenshot({ path: foto(String(n).padStart(2, '0') + '-' + s.slice(1) + '.png') });
        n++;
        if (s === '#servicios') {
          const alturas = await page.evaluate(() => [...document.querySelectorAll('.pila__item .tarjeta')].map(t => {
            /* la marca de agua sale a propósito por el borde: cuenta el contenido */
            const caja = t.getBoundingClientRect();
            const cabe = [...t.querySelectorAll('.tarjeta__cabeza, .tarjeta__cuerpo')].every(h => h.getBoundingClientRect().bottom <= caja.bottom + 1);
            return { alto: t.offsetHeight, cabe };
          }));
          comprobar(new Set(alturas.map(a => a.alto)).size === 1 && alturas.every(a => a.cabe), 'pila: todas las tarjetas miden lo mismo y su contenido cabe → ' + alturas.map(a => a.alto).join(','));
          const altoMax = Math.max(...alturas.map(a => a.alto));
          comprobar(altoMax < 900 * 0.85, 'pila: tarjetas a la medida del contenido, no de la pantalla (' + altoMax + 'px)');
          await rueda(page, 5, 500);
          if (CAPTURAS) await page.screenshot({ path: foto(String(n++).padStart(2, '0') + '-servicios-pila.png') });
        }
        if (s === '#primera-visita') {
          await rueda(page, 3, 400);
          const enc = await page.evaluate(() => document.querySelectorAll('.paso.encendido').length);
          comprobar(enc >= 1, 'primera visita: la línea avanza y enciende pasos (' + enc + ')');
        }
      }
      await rueda(page, 4, 700);
      if (CAPTURAS) await page.screenshot({ path: foto(String(n).padStart(2, '0') + '-pie.png') });

      const cifras = await page.$$eval('[data-contador]', ns => ns.map(n => n.textContent.trim()));
      const especiesN = String(negocio.especies.length);
      comprobar(cifras.includes(especiesN), 'contadores con su valor final → ' + cifras.join(' / '));
      const hoy = await page.evaluate(() => !!document.querySelector('.horario tr.es-hoy'));
      comprobar(hoy, 'el día de hoy marcado en el horario');
      /* una clase que choca con otra regla (pasó con .hoy) puede esconder justo la fila de hoy */
      const filas = await page.evaluate(() => [...document.querySelectorAll('.horario tr')].filter(tr => tr.getBoundingClientRect().height > 0).length);
      comprobar(filas === 7, 'el horario enseña los siete días, el de hoy incluido (' + filas + '/7)');

      const ck = await page.evaluate(() => { const c = document.getElementById('cookies'); return { oculto: c.hidden, display: getComputedStyle(c).display }; });
      comprobar(!ck.oculto && ck.display === 'flex', 'el aviso de cookies se ve al entrar');
      await page.click('#cookies-aceptar'); await page.waitForTimeout(300);
      comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display) === 'none', 'el botón de cookies lo cierra de verdad');

      const ifrAntes = await page.$$eval('iframe', n => n.length);
      await page.click('#mapa-boton'); await page.waitForTimeout(700);
      const ifrDespues = await page.$$eval('iframe', n => n.length);
      comprobar(ifrAntes === 0 && ifrDespues === 1, 'el iframe del mapa no existe hasta el clic (' + ifrAntes + ' → ' + ifrDespues + ')');

      if (hayMando) {
        const m = await page.evaluate(() => { const x = document.getElementById('mando'); return { oculto: x.hidden, display: getComputedStyle(x).display }; });
        comprobar(m.oculto && m.display === 'none', 'sin ?revision no se ve ningún mando');
      }
      const largasTotal = await page.evaluate(() => window.__largas || []);
      notas.push('INFO  · tareas largas al cargar: ' + (largasTotal.length ? largasTotal.join(', ') + ' ms' : 'ninguna'));
      comprobar(errores.length === 0, 'consola sin errores' + (errores.length ? ' → ' + errores.join(' | ') : ''));
      const reales = caidas.filter(c => !ignorables(c));
      comprobar(!reales.length, 'sin peticiones caídas' + (reales.length ? ' → ' + reales.join(' | ') : ''));
      await contexto.close();
    }

    /* ═════════════ 1b. pila en página limpia, bajando desde arriba ═════════════ */
    {
      const { contexto, page } = await nuevaPagina({ sinCookies: true });
      await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(4200);
      await page.mouse.move(720, 450);
      await hasta(page, '.pila__item:nth-last-child(2)', 300);
      const tope = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.pila__item')).top));
      let ultimo = null, sueltaAntes = null, asoma = null, separan = null, posada = false;
      for (let i = 0; i < 50; i++) {
        await page.mouse.wheel(0, 90); await page.waitForTimeout(160);
        const m = await page.evaluate(() => [...document.querySelectorAll('.pila__item')].map(li => { const r = li.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }));
        ultimo = m;
        const u = m[m.length - 1], ant = m.slice(0, -1);
        if (!posada && u[0] > tope + 2 && u[0] < 900 && ant.some(a => a[0] < tope - 2)) sueltaAntes = sueltaAntes || { paso: i, m };
        if (Math.abs(u[0] - tope) <= 2) { posada = true; if (ant.some(a => a[1] > u[1] + 1)) asoma = asoma || { paso: i, m }; }
        if (posada && ant.some(a => Math.abs(a[0] - u[0]) > 2)) separan = separan || { paso: i, m };
      }
      const sin = posada ? '' : ' (la última no llegó a posarse: ' + JSON.stringify(ultimo) + ')';
      comprobar(posada && !sueltaAntes, 'pila: ninguna se suelta antes de que se pose la última' + (sueltaAntes ? ' → ' + JSON.stringify(sueltaAntes) : '') + sin);
      comprobar(posada && !asoma, 'pila: nada asoma por debajo de la última' + (asoma ? ' → ' + JSON.stringify(asoma) : '') + sin);
      comprobar(posada && !separan, 'pila: al acabarse salen todas juntas' + (separan ? ' → ' + JSON.stringify(separan) : '') + sin);
      /* el hueco del margen de la última lo tapa lo que sigue */
      await rueda(page, 3, 300);
      const hueco = await page.evaluate(() => {
        const t = [...document.querySelectorAll('.pila__item .tarjeta')].pop().getBoundingClientRect();
        const pie = document.querySelector('.servicios__pie').getBoundingClientRect();
        return Math.round(pie.top - t.bottom);
      });
      comprobar(hueco < 160, 'pila: sin hueco vacío tras la última (' + hueco + 'px hasta lo siguiente)');
      await contexto.close();
    }

    /* ═════════════ 2. estado en vivo ═════════════ */
    {
      const { contexto, page } = await nuevaPagina({ sinCookies: true });
      await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      for (const [iso, abierto, patron, nombre] of CASOS) {
        const r = await page.evaluate(([i, d]) => window.__estadoClinica(i, d), [iso, HORARIO_PRUEBA]);
        comprobar(r.abierto === abierto && patron.test(r.texto), 'estado: ' + nombre + ' → «' + r.texto + '»');
      }
      await contexto.close();
      /* y en el DOM con el reloj falso: un lunes a las 14:15 */
      const b = await nuevaPagina({ sinCookies: true });
      await b.page.clock.setFixedTime(new Date('2026-10-05T14:15:00+02:00'));
      await b.page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
      await b.page.waitForTimeout(500);
      const dom = await b.page.evaluate(() => ({ texto: document.querySelector('[data-estado-texto]').textContent, fila: (document.querySelector('.horario tr.es-hoy th') || {}).textContent }));
      const esperado = await b.page.evaluate(() => window.__estadoClinica(new Date().toISOString()).texto);
      comprobar(dom.texto === esperado && dom.fila === 'Lunes', 'estado en el DOM con reloj falso (lunes 14:15) → «' + dom.texto + '», fila ' + dom.fila);
      await b.contexto.close();
    }

    /* ═════════════ 3. mandos: versión, paleta y marca ═════════════ */
    if (hayMando) {
      const { contexto, page, errores } = await nuevaPagina();
      await page.goto(base + '/index.html?revision', { waitUntil: 'networkidle' });
      await page.waitForTimeout(4400);
      const apartado = await page.evaluate(() => { const e = getComputedStyle(document.getElementById('mando')); return e.visibility === 'hidden' || e.opacity === '0'; });
      comprobar(apartado, 'el mando se aparta mientras el aviso de cookies está en pantalla');
      await page.click('#cookies-aceptar'); await page.waitForTimeout(500);
      comprobar(await page.evaluate(() => !document.getElementById('mando').hidden && getComputedStyle(document.getElementById('mando')).visibility !== 'hidden'), 'con ?revision el mando aparece al cerrar las cookies');

      await page.click('[data-densidad="sobria"]'); await page.waitForTimeout(900);
      const s = await page.evaluate(() => ({
        clase: document.documentElement.className,
        marca: getComputedStyle(document.querySelector('.tarjeta__marca')).display,
        hoy: getComputedStyle(document.getElementById('hoy')).display,
        clip: getComputedStyle(document.getElementById('ventana-recorte')).clipPath,
        viva: document.getElementById('inicio').classList.contains('hero--viva'),
        estado: getComputedStyle(document.querySelector('.estado__marca')).display,
        desborda: document.documentElement.scrollWidth - window.innerWidth,
        pulsado: document.querySelector('[data-densidad="sobria"]').getAttribute('aria-pressed')
      }));
      comprobar(s.clase.includes('densidad-sobria') && s.pulsado === 'true', 'sobria: cambia la clase y aria-pressed');
      comprobar(s.marca === 'none' && s.clip === 'none' && !s.viva, 'sobria: el isotipo se retira de tarjetas y hero → ' + JSON.stringify({ marca: s.marca, clip: s.clip, viva: s.viva }));
      comprobar(s.estado !== 'none', 'sobria: el isotipo sigue en el estado en vivo');
      comprobar(s.hoy === 'grid', 'sobria: entra «Hoy en la clínica», que la otra no tiene');
      comprobar(s.desborda <= 1, 'sobria: sin desbordamiento (' + s.desborda + 'px)');
      if (CAPTURAS) {
        await page.screenshot({ path: foto('20-sobria-hero.png') });
        await hasta(page, '#hoy'); await page.screenshot({ path: foto('21-sobria-hoy.png') });
        await hasta(page, '#servicios'); await rueda(page, 2, 500); await page.screenshot({ path: foto('22-sobria-servicios.png') });
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      comprobar((await page.evaluate(() => document.documentElement.className)).includes('densidad-sobria'), 'la versión elegida se aplica sin parpadeo al recargar');
      await page.waitForTimeout(4200);
      await page.click('[data-densidad="marca"]'); await page.waitForTimeout(700);
      comprobar(await page.evaluate(() => getComputedStyle(document.querySelector('.tarjeta__marca')).display !== 'none'), 'se puede volver a «La marca manda»');

      /* paleta */
      const acentoDe = () => page.evaluate(() => getComputedStyle(document.querySelector('.hero__acciones .boton--cita')).backgroundColor);
      const a0 = await acentoDe();
      await page.click('[data-paleta="b"]'); await page.waitForTimeout(400);
      const a1 = await acentoDe();
      const guardada = await page.evaluate(k => localStorage.getItem(k), marca.slug + '-paleta');
      comprobar(a0 !== a1 && guardada === 'b', 'paleta B cambia el color real del botón y se guarda → ' + a0 + ' → ' + a1);
      if (CAPTURAS) await page.screenshot({ path: foto('23-paleta-b.png') });
      await page.reload({ waitUntil: 'domcontentloaded' });
      comprobar(await page.evaluate(() => document.documentElement.getAttribute('data-paleta')) === 'b', 'la paleta guardada se aplica sin parpadeo al recargar');
      await page.waitForTimeout(4200);
      await page.click('[data-paleta="c"]'); await page.waitForTimeout(400);
      if (CAPTURAS) await page.screenshot({ path: foto('24-paleta-c.png') });
      await page.click('[data-paleta="a"]'); await page.waitForTimeout(300);

      /* marca de prueba: «así quedaría con tu logo» */
      const marcas = JSON.parse(await page.evaluate(() => document.getElementById('mando-marcas').textContent));
      for (const m of marcas.slice(1)) {
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
        await page.click('[data-cambiar-marca="' + m.slug + '"]'); await page.waitForTimeout(1600);
        const r = await page.evaluate(() => ({
          marca: document.documentElement.getAttribute('data-marca'),
          personalidad: document.documentElement.getAttribute('data-personalidad'),
          uso: document.querySelector('.cabecera .logo__original use').getAttribute('href'),
          h1: document.getElementById('hero-titulo').getAttribute('aria-label'),
          fondo: getComputedStyle(document.body).backgroundColor,
          desborda: document.documentElement.scrollWidth - window.innerWidth
        }));
        comprobar(r.marca === m.slug && r.personalidad === m.personalidad && r.uso === '#logo-' + m.slug && r.h1 === m.nombre_corto && r.desborda <= 1,
          'mando de marca → ' + m.slug + ': cambia hoja, logo, nombre y personalidad sin desbordar → ' + JSON.stringify(r));
        if (CAPTURAS) await page.screenshot({ path: foto('25-mando-marca-' + m.slug + '.png') });
      }
      comprobar(errores.length === 0, 'mandos: consola sin errores' + (errores.length ? ' → ' + errores.join(' | ') : ''));
      await contexto.close();
    }

    /* ═════════════ 4. móvil: menú, mando y viewport ═════════════ */
    {
      const { contexto, page, errores } = await nuevaPagina({ viewport: { width: 390, height: 844 } });
      await page.goto(base + '/index.html' + (hayMando ? '?revision' : ''), { waitUntil: 'networkidle' });
      await page.waitForTimeout(4400);
      const vp = await page.evaluate(() => ({ w: window.innerWidth, s: document.documentElement.scrollWidth }));
      comprobar(vp.w === 390 && vp.s - vp.w <= 1, 'móvil: el viewport no se ensancha → ' + JSON.stringify(vp));
      if (CAPTURAS) await page.screenshot({ path: foto('30-movil-hero.png') });
      await page.click('#cookies-aceptar'); await page.waitForTimeout(400);
      await page.click('#hamburguesa'); await page.waitForTimeout(800);
      comprobar(await page.evaluate(() => document.getElementById('hamburguesa').getAttribute('aria-expanded')) === 'true', 'móvil: el menú abre');
      if (CAPTURAS) await page.screenshot({ path: foto('31-movil-menu.png') });
      await page.click('#hamburguesa', { timeout: 4000 }); await page.waitForTimeout(800);
      comprobar(await page.evaluate(() => document.getElementById('hamburguesa').getAttribute('aria-expanded')) === 'false', 'móvil: el mismo botón cierra el menú');
      await rueda(page, 8, 700);
      const panel = await page.evaluate(() => { const n = document.getElementById('menu').getBoundingClientRect(); return { fija: document.getElementById('cabecera').classList.contains('cabecera--fija'), bottom: Math.round(n.bottom), alto: Math.round(n.height) }; });
      comprobar(panel.fija && panel.bottom <= 1 && panel.alto >= 800, 'móvil: con la cabecera fija el menú cerrado queda fuera → ' + JSON.stringify(panel));
      await page.click('#hamburguesa'); await page.waitForTimeout(900);
      const abierto = await page.evaluate(() => Math.round(document.getElementById('menu').getBoundingClientRect().height));
      comprobar(abierto >= 800, 'móvil: con la cabecera fija (blur) el menú abierto ocupa toda la pantalla (' + abierto + 'px)');
      if (CAPTURAS) await page.screenshot({ path: foto('32-movil-menu-fija.png') });
      await page.click('#hamburguesa'); await page.waitForTimeout(700);
      if (CAPTURAS) {
        let k = 33;
        for (const s of ['#especies', '#servicios', '#urgencias', '#primera-visita', '#equipo', '#instalaciones', '#opiniones', '#visita']) {
          if (await hasta(page, s)) await page.screenshot({ path: foto(k++ + '-movil-' + s.slice(1) + '.png') });
        }
      }
      comprobar(errores.length === 0, 'móvil: consola sin errores' + (errores.length ? ' → ' + errores.join(' | ') : ''));
      await contexto.close();
    }

    /* ═════════════ 4b. hero en pantallas bajas: nada se pisa (checklist 6) ═════════════ */
    for (const vp of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      const { contexto, page } = await nuevaPagina({ viewport: vp, sinCookies: true });
      await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(4600);
      const r = await page.evaluate(() => {
        const c = e => e.getBoundingClientRect();
        const v = c(document.getElementById('ventana-hero')), t = c(document.querySelector('.hero__texto')), h1 = document.getElementById('hero-titulo');
        const cab = c(document.getElementById('cabecera'));
        return { vAbajo: Math.round(v.bottom), vArriba: Math.round(v.top), vDer: Math.round(v.right), tArriba: Math.round(t.top), tIzq: Math.round(t.left), tDer: Math.round(t.right), cab: Math.round(cab.bottom), h1: h1.scrollWidth <= h1.clientWidth + 2, ancho: window.innerWidth };
      });
      const movil = vp.width <= 900;
      const noPisa = movil ? r.tArriba >= r.vAbajo + 8 : (r.tDer <= r.vDer && true);
      comprobar(noPisa && r.vArriba >= r.cab - 2 && r.h1, 'hero ' + vp.width + '×' + vp.height + ': texto, ventana y cabecera no se pisan y el nombre cabe → ' + JSON.stringify(r));
      if (CAPTURAS) await page.screenshot({ path: foto('4b-hero-' + vp.width + 'x' + vp.height + '.png') });
      await contexto.close();
    }

    /* ═════════════ 5. sin GSAP ═════════════ */
    {
      const { contexto, page, errores } = await nuevaPagina();
      await page.route('**/cdn.jsdelivr.net/**', r => r.abort());
      await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const e = await page.evaluate(() => ({ cortina: getComputedStyle(document.getElementById('cortina')).display, mov: document.documentElement.classList.contains('con-movimiento'), estado: document.querySelector('[data-estado-texto]').textContent }));
      comprobar(e.cortina === 'none', 'sin GSAP: la cortina se retira igual');
      comprobar(!e.mov, 'sin GSAP: no se activa con-movimiento');
      comprobar(/Abierto|Cerrado/.test(e.estado), 'sin GSAP: el estado en vivo funciona');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)); await page.waitForTimeout(400);
      const apagados = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, p, img, .especie, .persona, .cita')].filter(n => parseFloat(getComputedStyle(n).opacity) < 0.15 && n.getBoundingClientRect().height > 0 && !n.closest('.cortina, .mando, .cookies, .hoy')).map(n => n.className || n.tagName));
      comprobar(!apagados.length, 'sin GSAP: nada queda apagado' + (apagados.length ? ' → ' + apagados.slice(0, 8).join(',') : ''));
      if (CAPTURAS) await page.screenshot({ path: foto('40-sin-gsap.png') });
      const propios = errores.filter(x => !/Failed to load resource|ERR_FAILED/.test(x));
      comprobar(!propios.length, 'sin GSAP: consola sin errores propios' + (propios.length ? ' → ' + propios.join(' | ') : ''));
      await contexto.close();
    }

    /* ═════════════ 6. movimiento reducido ═════════════ */
    {
      const { contexto, page, errores } = await nuevaPagina({ reducedMotion: 'reduce' });
      await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display) === 'none', 'movimiento reducido: la cortina se retira');
      comprobar(!(await page.evaluate(() => document.documentElement.classList.contains('con-movimiento'))), 'movimiento reducido: sin con-movimiento (los titulares partidos se ven)');
      await page.evaluate(() => document.getElementById('especies').scrollIntoView()); await page.waitForTimeout(700);
      const n = await page.evaluate(() => document.querySelector('.especies__n').textContent.trim());
      comprobar(n === String(negocio.especies.length), 'movimiento reducido: el contador muestra el dato → ' + n);
      const pasos = await page.evaluate(() => [document.querySelectorAll('.paso').length, document.querySelectorAll('.paso.encendido').length]);
      comprobar(pasos[0] === pasos[1], 'movimiento reducido: los pasos de la primera visita se ven encendidos');
      if (CAPTURAS) await page.screenshot({ path: foto('41-movimiento-reducido.png') });
      comprobar(errores.length === 0, 'movimiento reducido: consola sin errores' + (errores.length ? ' → ' + errores.join(' | ') : ''));
      await contexto.close();
    }

    /* ═════════════ 7. 404 y páginas legales ═════════════ */
    {
      const { contexto, page, errores } = await nuevaPagina({ sinCookies: true });
      const r = await page.goto(base + '/no-existe/tampoco.html', { waitUntil: 'networkidle' });
      const h1 = await page.textContent('h1').catch(() => '');
      const estilo = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim());
      comprobar(r.status() === 404 && h1.length > 5 && estilo !== '', '404 propio con el lenguaje del sitio (también en una ruta anidada) → «' + h1 + '»');
      if (CAPTURAS) await page.screenshot({ path: foto('50-404.png') });
      errores.length = 0;      /* el 404 del propio documento es lo que se está probando */
      for (const p of ['aviso-legal.html', 'privacidad.html']) {
        await page.goto(base + '/' + p, { waitUntil: 'networkidle' });
        const t = await page.textContent('main');
        comprobar(t.includes(negocio.legal.titular) && t.includes(negocio.legal.nif), p + ' con titular y NIF');
      }
      comprobar(errores.length === 0, 'legales y 404: consola sin errores' + (errores.length ? ' → ' + errores.join(' | ') : ''));
      await contexto.close();
    }
  }

  /* ═════════════ 8. RESKIN: la prueba de que la plantilla se cambia sin tocar código ═════════════ */
  if (!RAPIDO && fs.existsSync(path.join(RAIZ, 'marca', 'pruebas'))) {
    const scratch = path.join(RAIZ, '_scratch');
    fs.mkdirSync(scratch, { recursive: true });
    const demo = { nombre: negocio.nombre, corto: negocio.nombre_corto, telefono: negocio.telefono, calle: negocio.direccion.calle };
    const demoColores = Object.values(marca.colores).map(c => c.toUpperCase());
    const demoFuentes = [parejas[marca.pareja].display.familia, parejas[marca.pareja].texto.familia];
    const copiar = destino => {
      fs.rmSync(destino, { recursive: true, force: true });
      fs.mkdirSync(destino, { recursive: true });
      /* entrada a entrada: cpSync no deja copiar una carpeta dentro de sí misma */
      for (const n of fs.readdirSync(RAIZ)) {
        if (['screenshots', '_scratch', '.git', 'node_modules'].includes(n)) continue;
        fs.cpSync(path.join(RAIZ, n), path.join(destino, n), { recursive: true });
      }
    };

    for (const slugPrueba of fs.readdirSync(path.join(RAIZ, 'marca', 'pruebas'))) {
      const origen = path.join(RAIZ, 'marca', 'pruebas', slugPrueba);
      if (!fs.existsSync(path.join(origen, 'marca.json'))) continue;
      const copia = path.join(scratch, 'reskin-' + slugPrueba);
      copiar(copia);
      /* el reskin de verdad: logo + marca.json + negocio.json + fotos, nada más */
      for (const f of ['logo.svg', 'logo-mono.svg', 'isotipo.svg', '_logo.png']) fs.rmSync(path.join(copia, 'marca', f), { force: true });
      for (const f of fs.readdirSync(origen)) if (!fs.statSync(path.join(origen, f)).isDirectory()) fs.copyFileSync(path.join(origen, f), path.join(copia, 'marca', f === 'negocio.json' ? '_nada' : f));
      fs.rmSync(path.join(copia, 'marca', '_nada'), { force: true });
      const neg = JSON.parse(leer(origen, 'negocio.json'));
      fs.writeFileSync(path.join(copia, 'negocio.json'), JSON.stringify(neg, null, 2));
      if (neg._sin_fotos) fs.rmSync(path.join(copia, 'media'), { recursive: true, force: true });
      fs.rmSync(path.join(copia, 'marca', 'pruebas'), { recursive: true, force: true });

      const t0 = Date.now();
      let salida = '';
      try { salida = execFileSync('node', [path.join(copia, 'scripts', 'aplicar.mjs'), '--sin-og'], { encoding: 'utf8', cwd: copia }); }
      catch (e) { comprobar(false, 'reskin ' + slugPrueba + ': aplicar.mjs falla → ' + (e.stdout || '') + (e.stderr || '')); continue; }
      const ms = Date.now() - t0;
      notas.push('INFO  · reskin ' + slugPrueba + ': aplicar.mjs en ' + ms + ' ms');
      comprobar(!/✗/.test(leer(copia, 'marca', '_contraste.txt').split('\n\n')[0]), 'reskin ' + slugPrueba + ': contraste AA de la nueva marca');

      const generados = ['index.html', 'aviso-legal.html', 'privacidad.html', '404.html', 'css/marca.css', 'manifest.json', 'favicon.svg'];
      const restos = [];
      for (const g of generados) {
        const t = leer(copia, g);
        const tU = t.toUpperCase();
        for (const [k, v] of Object.entries(demo)) if (v && t.toLowerCase().includes(String(v).toLowerCase())) restos.push(g + ': ' + k + ' «' + v + '»');
        for (const c of demoColores) if (tU.includes(c)) restos.push(g + ': color ' + c);
        for (const f of demoFuentes) if (t.includes(f)) restos.push(g + ': fuente ' + f);
      }
      comprobar(!restos.length, 'reskin ' + slugPrueba + ': no queda NI UN resto de la marca de demo' + (restos.length ? ' → ' + restos.slice(0, 8).join(' | ') : ''));

      const index = leer(copia, 'index.html');
      const mods = neg.modulos || {};
      const modoUrg = mods.urgencias === false ? 'ninguno' : ((neg.urgencias || {}).modo || 'ninguno');
      if (modoUrg === 'ninguno') comprobar(!/data-modulo="urgencias"|id="urgencias"/.test(index), 'reskin ' + slugPrueba + ': urgencias «ninguno» quita la sección del HTML');

      /* en el navegador */
      const srv = crearServidor(copia, null);
      await new Promise(r => srv.listen(4193, '127.0.0.1', r));
      try {
        for (const vp of [{ width: 1440, height: 900 }, { width: 360, height: 640 }]) {
          const { contexto, page, errores } = await nuevaPagina({ viewport: vp, sinCookies: true, claveCookies: JSON.parse(leer(copia, 'marca', 'marca.json')).slug + '-cookies' });
          await page.goto('http://127.0.0.1:4193/index.html', { waitUntil: 'networkidle' });
          await page.waitForTimeout(4600);
          const r = await page.evaluate(() => {
            const c = e => e.getBoundingClientRect();
            const v = c(document.getElementById('ventana-hero')), t = c(document.querySelector('.hero__texto')), h1 = document.getElementById('hero-titulo');
            const texto = document.body.innerText;
            const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
            const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
            const cr = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
            const fondo = getComputedStyle(document.body).backgroundColor;
            const boton = getComputedStyle(document.querySelector('.hero__acciones .boton'));
            return {
              pisa: window.innerWidth <= 900 ? t.top < v.bottom + 8 : t.right > v.left + 4,
              h1: h1.scrollWidth <= h1.clientWidth + 2,
              desborda: document.documentElement.scrollWidth - window.innerWidth,
              urgencias: /urgencia/i.test(texto),
              recuento: (document.querySelector('.resenas__fuente') || { textContent: '' }).textContent,
              contraste: {
                tinta: +cr(getComputedStyle(document.querySelector('.hero__titulo')).color, fondo).toFixed(2),
                apagado: +cr(getComputedStyle(document.querySelector('.hero__entrada')).color, fondo).toFixed(2),
                boton: +cr(boton.color, boton.backgroundColor).toFixed(2)
              }
            };
          });
          const etiqueta = 'reskin ' + slugPrueba + ' ' + vp.width + '×' + vp.height;
          comprobar(!r.pisa && r.h1 && r.desborda <= 1, etiqueta + ': el hero no se pisa, el nombre cabe y no desborda → ' + JSON.stringify({ pisa: r.pisa, h1: r.h1, desborda: r.desborda }));
          comprobar(r.contraste.tinta >= 4.5 && r.contraste.apagado >= 4.5 && r.contraste.boton >= 4.5, etiqueta + ': contraste AA medido en el navegador → ' + JSON.stringify(r.contraste));
          if (modoUrg === 'ninguno') comprobar(!r.urgencias, etiqueta + ': ni una mención a urgencias en el texto visible');
          if ((neg.resenas || {}).recuento < 20) comprobar(!/\d/.test(r.recuento), etiqueta + ': con menos de 20 reseñas no se enseña el recuento → «' + r.recuento + '»');
          comprobar(errores.length === 0, etiqueta + ': consola sin errores' + (errores.length ? ' → ' + errores.join(' | ') : ''));
          if (CAPTURAS) {
            await page.screenshot({ path: foto('60-reskin-' + slugPrueba + '-' + vp.width + '.png') });
            if (vp.width === 1440) {
              for (const s of ['#especies', '#servicios', '#visita']) { if (await hasta(page, s)) await page.screenshot({ path: foto('61-reskin-' + slugPrueba + '-' + s.slice(1) + '.png') }); }
            }
          }
          await contexto.close();
        }
      } finally { srv.close(); }
    }

    /* ═════════════ 9. parejas tipográficas × nombres extremos ═════════════ */
    {
      const copia = path.join(scratch, 'parejas');
      copiar(copia);
      const srv = crearServidor(copia, null);
      await new Promise(r => srv.listen(4194, '127.0.0.1', r));
      const nombres = ['Kiv', 'Clínica Veterinaria San Francisco de Asís'];
      const malas = [];
      try {
        for (const clave of Object.keys(parejas).filter(k => k[0] !== '_')) {
          for (const nombre of nombres) {
            const m = JSON.parse(leer(copia, 'marca', 'marca.json')); m.pareja = clave;
            fs.writeFileSync(path.join(copia, 'marca', 'marca.json'), JSON.stringify(m, null, 2));
            const ng = JSON.parse(leer(copia, 'negocio.json')); ng.nombre_corto = nombre;
            fs.writeFileSync(path.join(copia, 'negocio.json'), JSON.stringify(ng, null, 2));
            execFileSync('node', [path.join(copia, 'scripts', 'aplicar.mjs'), '--sin-og', '--silencio'], { cwd: copia });
            for (const vp of [{ width: 360, height: 640 }, { width: 1440, height: 900 }]) {
              const { contexto, page } = await nuevaPagina({ viewport: vp, sinCookies: true, reducedMotion: 'reduce' });
              await page.goto('http://127.0.0.1:4194/index.html', { waitUntil: 'networkidle' });
              await page.evaluate(() => document.fonts.ready);
              await page.waitForTimeout(400);
              const r = await page.evaluate(() => {
                const h1 = document.getElementById('hero-titulo');
                const v = document.getElementById('ventana-hero').getBoundingClientRect(), t = document.querySelector('.hero__texto').getBoundingClientRect();
                return { cabe: h1.scrollWidth <= h1.clientWidth + 2, pisa: window.innerWidth <= 900 ? t.top < v.bottom + 8 : t.right > v.left + 4, desborda: document.documentElement.scrollWidth - window.innerWidth, tam: getComputedStyle(h1).fontSize };
              });
              if (!r.cabe || r.pisa || r.desborda > 1) malas.push(clave + ' «' + nombre + '» ' + vp.width + ': ' + JSON.stringify(r));
              if (CAPTURAS && vp.width === 360) await page.screenshot({ path: foto('70-pareja-' + clave + '-' + (nombre.length > 5 ? 'largo' : 'corto') + '.png') });
              await contexto.close();
            }
          }
        }
      } finally { srv.close(); }
      comprobar(!malas.length, 'las 5 parejas con «Kiv» y con el nombre más largo: el hero no desborda ni se pisa a 360 y 1440' + (malas.length ? ' → ' + malas.join(' | ') : ''));
    }
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log('\n' + notas.join('\n'));
if (fallos.length) {
  console.log('\n──────── FALLOS ────────\n' + fallos.join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nTodo en orden: ' + notas.filter(n => n.startsWith('OK')).length + ' comprobaciones.');
}
