/* aplicar.mjs — escribe la web a partir de los cuatro sitios de la marca.

     negocio.json          datos del negocio y módulos encendidos
     marca/marca.json      colores, pareja tipográfica, personalidad
     marca/logo.svg        logotipo (y marca/isotipo.svg si lo hay)
     media/                fotos con nombre fijo (todas opcionales)

   Genera: index.html, aviso-legal.html, privacidad.html, 404.html (desde fuente/),
   css/marca.css, favicon.svg, manifest.json, assets/og.jpg y, si el mando de
   maqueta sigue en la fuente, css/marcas/<slug>.css para las marcas de prueba.

   node scripts/aplicar.mjs             todo
   node scripts/aplicar.mjs --sin-og    sin la imagen para redes (más rápido)
   node scripts/aplicar.mjs --forzar    escribe aunque falle algún contraste

   Sin dependencias de npm: solo Node. La og:image usa Playwright si lo encuentra. */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderizar } from './lib/plantilla.mjs';
import { derivarTokens, paletaGirada, esOscuro, contraste } from './lib/color.mjs';
import { leerViewBox, interior, prefijarIds, monocromo, silueta, detalles, monograma, vbTexto } from './lib/svg.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SIN_OG = args.includes('--sin-og');
const FORZAR = args.includes('--forzar');
const SILENCIO = args.includes('--silencio');

const r = (...p) => path.join(RAIZ, ...p);
const existe = p => fs.existsSync(r(p));
const leer = p => fs.readFileSync(r(p), 'utf8');
const leerJSON = p => JSON.parse(leer(p));
const log = (...a) => { if (!SILENCIO) console.log(...a); };
const errores = [];
const avisos = [];

/* ───────────────────────── carga y validación ───────────────────────── */
const negocio = leerJSON('negocio.json');
const parejas = leerJSON('scripts/parejas.json');

const OBLIGATORIOS = ['nombre', 'nombre_corto', 'lema', 'entradilla', 'direccion.calle', 'direccion.cp',
  'direccion.localidad', 'direccion.provincia', 'telefono', 'email', 'horario', 'especies', 'servicios',
  'legal.titular', 'legal.nif'];
const valor = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
for (const campo of OBLIGATORIOS) {
  const v = valor(negocio, campo);
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) errores.push('negocio.json: falta «' + campo + '»');
}
if (negocio.demo) {
  const plano = JSON.stringify(negocio);
  if (/\[PENDIENTE/i.test(plano) || /\bTODO\b/.test(plano) || /lorem ipsum/i.test(plano)) errores.push('negocio.json: una demo no puede llevar [PENDIENTE], TODO ni relleno (PLIEGO §0)');
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const NOMBRE_DIA = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
for (const d of DIAS) {
  const f = negocio.horario && negocio.horario[d];
  if (!Array.isArray(f)) { errores.push('negocio.json: horario.' + d + ' tiene que ser una lista (vacía si cierra)'); continue; }
  for (const franja of f) {
    if (!Array.isArray(franja) || franja.length !== 2 || !franja.every(h => /^\d{2}:\d{2}$/.test(h))) errores.push('negocio.json: horario.' + d + ' → franjas como ["09:30","14:00"]');
  }
}

const ESPECIES = {
  perro: 'Perros', gato: 'Gatos', conejo: 'Conejos', huron: 'Hurones',
  ave: 'Aves', reptil: 'Reptiles', roedor: 'Pequeños mamíferos'
};
for (const e of negocio.especies || []) if (!ESPECIES[e]) errores.push('negocio.json: especie desconocida «' + e + '» (valen: ' + Object.keys(ESPECIES).join(', ') + ')');

/* ───────────────────────── marcas ───────────────────────── */
const hayMando = leer('fuente/index.html').includes('[MANDO DE MAQUETA]');

/* --fijar-paleta b|c: el cliente eligió en la reunión una de las alternativas
   del mando; se copian esos colores a marca.json y pasa a ser la paleta real */
const fijar = (args[args.indexOf('--fijar-paleta') + 1] || '').toLowerCase();
if (args.includes('--fijar-paleta')) {
  if (!['b', 'c'].includes(fijar)) { console.error('--fijar-paleta b | c'); process.exit(1); }
  const conf = leerJSON('marca/marca.json');
  const girada = paletaGirada(conf.colores, fijar === 'b' ? 120 : -120);
  conf.colores = { ...conf.colores, acento: girada.acento, acento2: girada.acento2 };
  fs.writeFileSync(r('marca/marca.json'), JSON.stringify(conf, null, 2) + '\n');
  log('✓ marca.json: paleta ' + fijar.toUpperCase() + ' fijada (acento ' + girada.acento + ', acento 2 ' + girada.acento2 + ')');
}

function cargarMarca(dir, esPrincipal) {
  const conf = JSON.parse(fs.readFileSync(path.join(dir, 'marca.json'), 'utf8'));
  const slug = String(conf.slug || '').toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(dir + '/marca.json: «slug» solo con a-z, 0-9 y guiones');
  const pareja = parejas[conf.pareja];
  if (!pareja) throw new Error(dir + '/marca.json: pareja «' + conf.pareja + '» no existe (valen: ' + Object.keys(parejas).filter(k => k[0] !== '_').join(', ') + ')');
  if (!['cercana', 'clinica', 'moderna'].includes(conf.personalidad)) throw new Error(dir + '/marca.json: personalidad cercana | clinica | moderna');

  const logoSrc = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf8');
  const logoVb = leerViewBox(logoSrc);
  if (logoVb[0] !== 0 || logoVb[1] !== 0) avisos.push(slug + ': el viewBox del logo no empieza en 0 0; pásalo por scripts/logo.mjs');
  const logoInt = prefijarIds(interior(logoSrc), 'l-' + slug);
  const monoRuta = path.join(dir, 'logo-mono.svg');
  const logoMono = fs.existsSync(monoRuta) ? prefijarIds(interior(fs.readFileSync(monoRuta, 'utf8')), 'lm-' + slug) : monocromo(prefijarIds(logoInt, 'lm'));

  const { tokens, informe, oscuro } = derivarTokens(conf.colores);

  let iso;
  const isoRuta = path.join(dir, 'isotipo.svg');
  if (fs.existsSync(isoRuta) && conf.isotipo !== 'monograma') {
    const src = fs.readFileSync(isoRuta, 'utf8');
    const vb = leerViewBox(src);
    const inter = interior(src);
    const sil = silueta(inter);
    if (!sil) throw new Error(slug + ': isotipo.svg sin <path data-silueta>');
    iso = {
      vb, silueta: sil, detalles: detalles(inter),
      original: prefijarIds(inter, 'i-' + slug),
      mono: monocromo(prefijarIds(inter, 'im-' + slug)),
      tipo: 'isotipo'
    };
  } else {
    const m = monograma(conf.nombre_inicial || conf.slug[0], tokens['--acento'], tokens['--sobre-acento']);
    iso = { ...m, tipo: 'monograma' };
  }

  /* la ventana del hero: el isotipo, o una forma de reserva si el isotipo es
     demasiado fino o raro para enseñar una foto dentro (RESKIN.md §6) */
  const forma = conf.forma_hero || 'isotipo';
  let ventana;
  if (forma === 'isotipo') ventana = { vb: iso.vb, d: iso.silueta };
  else if (forma === 'circulo') ventana = { vb: [0, 0, 100, 100], d: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z' };
  else if (forma === 'arco') ventana = { vb: [0, 0, 90, 110], d: 'M0 110V45A45 45 0 0 1 90 45V110Z' };
  else throw new Error(slug + ': forma_hero isotipo | circulo | arco');

  return { dir, conf, slug, pareja, tokens, informe, oscuro, logo: { vb: logoVb, original: logoInt, mono: logoMono }, iso, ventana, esPrincipal };
}

const principal = cargarMarca(r('marca'), true);
const pruebas = [];
if (hayMando && existe('marca/pruebas')) {
  for (const d of fs.readdirSync(r('marca/pruebas')).sort()) {
    const dir = r('marca/pruebas', d);
    if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'marca.json'))) pruebas.push(cargarMarca(dir, false));
  }
}
const marcas = [principal, ...pruebas];

/* ───────────────────────── contraste ───────────────────────── */
for (const m of marcas) {
  const filas = [['a', m.informe]];
  for (const [clave, grados] of [['b', 120], ['c', -120]]) filas.push([clave, derivarTokens(paletaGirada(m.conf.colores, grados)).informe]);
  for (const [pal, inf] of filas) {
    for (const f of inf) if (f.ratio < f.min) (m.esPrincipal && pal === 'a' ? errores : avisos).push(`${m.slug} paleta ${pal}: ${f.texto} sobre ${f.fondo} = ${f.ratio}:1 (mínimo ${f.min})`);
  }
}

/* ───────────────────────── CSS de marca ───────────────────────── */
function cssMarca(m) {
  const p = m.pareja;
  const bloque = (sel, tk) => sel + ' {\n' + Object.entries(tk).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n';
  const soloAcento = tk => Object.fromEntries(Object.entries(tk).filter(([k]) => /acento|boton|cortina|foco|foto/.test(k)));
  const tB = derivarTokens(paletaGirada(m.conf.colores, 120)).tokens;
  const tC = derivarTokens(paletaGirada(m.conf.colores, -120)).tokens;
  const [, , vw, vh] = m.ventana.vb;
  const base = {
    ...m.tokens,
    '--muestra-a': m.tokens['--acento'],
    '--muestra-b': tB['--acento'],
    '--muestra-c': tC['--acento'],
    '--f-display': `'${p.display.familia}', ${p.display.respaldo}`,
    '--f-texto': `'${p.texto.familia}', ${p.texto.respaldo}`,
    '--peso-display': p.display.peso,
    '--tracking-display': p.display.tracking,
    '--escala-display': p.escala,
    '--ancho-letra': p.ancho,
    '--ventana-aspecto': `${+vw.toFixed(3)} / ${+vh.toFixed(3)}`,
    '--logo-aspecto': `${+m.logo.vb[2].toFixed(3)} / ${+m.logo.vb[3].toFixed(3)}`
  };
  return '/* GENERADO por scripts/aplicar.mjs desde ' + path.relative(RAIZ, m.dir).replace(/\\/g, '/') + '/marca.json.\n' +
    '   No editar a mano. Es el ÚNICO archivo con colores y fuentes de la marca. */\n' +
    bloque(':root', base) +
    bloque(':root[data-paleta="b"]', soloAcento(tB)) +
    bloque(':root[data-paleta="c"]', soloAcento(tC));
}

/* ───────────────────────── sprite ───────────────────────── */
function simbolosMarca(m) {
  const vbL = vbTexto(m.logo.vb), vbI = vbTexto(m.iso.vb), vbV = vbTexto(m.ventana.vb);
  const [vx, vy, vw, vh] = m.ventana.vb;
  return [
    `<symbol id="logo-${m.slug}" viewBox="${vbL}">${m.logo.original}</symbol>`,
    `<symbol id="logo-mono-${m.slug}" viewBox="${vbL}">${m.logo.mono}</symbol>`,
    `<symbol id="isotipo-${m.slug}" viewBox="${vbI}">${m.iso.original}</symbol>`,
    `<symbol id="isotipo-mono-${m.slug}" viewBox="${vbI}">${m.iso.mono}</symbol>`,
    `<symbol id="silueta-${m.slug}" viewBox="${vbV}"><path d="${m.ventana.d}" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"/></symbol>`,
    `<clipPath id="ventana-caja-${m.slug}" clipPathUnits="objectBoundingBox"><path d="${m.ventana.d}" transform="scale(${1 / vw} ${1 / vh}) translate(${-vx} ${-vy})"/></clipPath>`,
    `<clipPath id="ventana-viva-${m.slug}" clipPathUnits="userSpaceOnUse"><path d="${m.ventana.d}" data-ventana-viva transform="scale(0)"/></clipPath>`
  ].join('\n');
}

function simbolosEspecies() {
  return Object.keys(ESPECIES).filter(e => (negocio.especies || []).includes(e)).map(e => {
    const f = r('ilustracion/especies', e + '.svg');
    if (!fs.existsSync(f)) { errores.push('Falta ilustracion/especies/' + e + '.svg'); return ''; }
    const src = fs.readFileSync(f, 'utf8');
    return `<symbol id="especie-${e}" viewBox="${vbTexto(leerViewBox(src))}">${prefijarIds(interior(src), 'e-' + e)}</symbol>`;
  }).join('\n');
}

/* ───────────────────────── media ───────────────────────── */
function medidasJpeg(archivo) {
  const b = fs.readFileSync(archivo);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const marca = b[i + 1];
    const largo = b.readUInt16BE(i + 2);
    if (marca >= 0xC0 && marca <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marca)) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  throw new Error('No se pudo leer el tamaño de ' + archivo);
}
function foto(ruta, alt) {
  if (!ruta || !existe(ruta)) return null;
  const { ancho, alto } = medidasJpeg(r(ruta));
  const r800 = ruta.replace(/\.jpg$/i, '-800.jpg');
  return { src: ruta, src800: existe(r800) ? r800 : ruta, ancho, alto, alt: alt || '' };
}

/* ───────────────────────── vista ───────────────────────── */
const soloDigitos = t => String(t).replace(/[^\d+]/g, '');
const telHref = t => { const d = soloDigitos(t); return 'tel:' + (d.startsWith('+') ? d : (d.length === 9 ? '+34' + d : d)); };
const waHref = (t, texto) => { let d = soloDigitos(t).replace('+', ''); if (d.length === 9) d = '34' + d; return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : ''); };
const hora = h => h.replace(/^0/, '');
const franjasTexto = f => f.length ? f.map(([a, b]) => hora(a) + '–' + hora(b)).join(' y ') : 'Cerrado';

const direccionLinea = `${negocio.direccion.calle}, ${negocio.direccion.cp} ${negocio.direccion.localidad} (${negocio.direccion.provincia})`;
const consultaMapa = negocio.mapa_consulta || `${negocio.nombre}, ${direccionLinea}`;

/* horario agrupado: «Lunes a viernes: 9:30–14:00 y 16:30–20:30» */
const grupos = [];
DIAS.forEach(d => {
  const t = franjasTexto(negocio.horario[d] || []);
  const ult = grupos[grupos.length - 1];
  if (ult && ult.t === t) ult.hasta = d; else grupos.push({ desde: d, hasta: d, t });
});
const horarioResumen = grupos.map(g => {
  const dias = g.desde === g.hasta ? NOMBRE_DIA[g.desde] : `${NOMBRE_DIA[g.desde]} a ${NOMBRE_DIA[g.hasta].toLowerCase()}`;
  return `${dias}: ${g.t === 'Cerrado' ? 'cerrado' : g.t}`;
});

const wa = negocio.whatsapp && negocio.whatsapp.confirmado && negocio.whatsapp.numero
  ? { numero: negocio.whatsapp.numero, href: waHref(negocio.whatsapp.numero, 'Hola, quería pedir cita en ' + negocio.nombre_corto + '.') } : null;

let cita;
const via = (negocio.cita && negocio.cita.via) || 'telefono';
if (via === 'whatsapp' && wa) cita = { href: wa.href, texto: 'Pedir cita por WhatsApp', corto: 'Por WhatsApp', icono: 'i-whatsapp', externa: true };
else if (via === 'enlace' && negocio.cita.enlace) cita = { href: negocio.cita.enlace, texto: 'Pedir cita en línea', corto: 'En línea', icono: 'i-flecha', externa: true };
else cita = { href: telHref(negocio.telefono), texto: 'Llamar para pedir cita', corto: 'Por teléfono · ' + negocio.telefono, icono: 'i-telefono', externa: false };
if (via === 'whatsapp' && !wa) avisos.push('cita.via = whatsapp pero el WhatsApp no está confirmado: la cita va por teléfono');

const modulos = { marquee: true, urgencias: true, primera_visita: true, equipo: true, instalaciones: true, resenas: true, preguntas: true, ...(negocio.modulos || {}) };

const u = negocio.urgencias || { modo: 'ninguno' };
const modoUrg = modulos.urgencias ? (u.modo || 'ninguno') : 'ninguno';
const urgTel = u.telefono || negocio.telefono;
const urg = modoUrg === 'ninguno' ? { activo: false, telefono_visible: false } : {
  activo: true,
  es24h: modoUrg === '24h',
  telefono_visible: true,
  telefono: urgTel,
  tel_href: telHref(urgTel),
  etiqueta: modoUrg === '24h' ? 'Urgencias 24 h' : 'Urgencias',
  titulo: modoUrg === '24h' ? 'Abiertos las 24 horas, todos los días.' : 'Si no puede esperar, llama.',
  horario: modoUrg === '24h' ? 'Todos los días, las 24 horas' : (u.horario || 'Fuera del horario de consulta'),
  texto: u.texto || (modoUrg === '24h' ? 'Siempre hay un veterinario en la clínica. Llama antes de venir y te esperamos preparados.' : 'Llama y te decimos qué hacer.')
};
if (!['ninguno', 'telefono', '24h'].includes(modoUrg)) errores.push('urgencias.modo: 24h | telefono | ninguno');

const serviciosActivos = (negocio.servicios || []).filter(s => s.activo !== false)
  .map((s, i) => ({ ...s, num: String(i + 1).padStart(2, '0'), incluye: s.incluye || [] }));
if (serviciosActivos.length < 2) errores.push('negocio.json: al menos dos servicios activos');

const especiesLista = Object.keys(ESPECIES).filter(e => (negocio.especies || []).includes(e)).map(e => ({ id: e, nombre: ESPECIES[e] }));

const iniciales = n => n.split(/\s+/).filter(p => p.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(p)).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const equipo = (negocio.equipo || []).map(p => {
  const slugP = p.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const f = p.foto && existe(p.foto) ? p.foto : (existe('media/equipo/' + slugP + '.jpg') ? 'media/equipo/' + slugP + '.jpg' : null);
  return { ...p, foto: f, iniciales: iniciales(p.nombre), colegiado: p.colegiado || null };
});
if (modulos.equipo && !equipo.length) modulos.equipo = false;

const instalacionesFotos = (negocio.instalaciones || []).map(i => { const f = foto(i.foto, i.alt); return f ? { ...f, pie: i.pie || '' } : null; }).filter(Boolean);
if (modulos.instalaciones && !instalacionesFotos.length) { modulos.instalaciones = false; log('· instalaciones: sin fotos en media/, el módulo se quita solo'); }

const rs = negocio.resenas || {};
const UMBRAL_RECUENTO = 20;       /* memoria «pocas reseñas»: por debajo, ni el número */
const conRecuento = Number(rs.recuento) >= UMBRAL_RECUENTO;
let fuenteTexto;
if (rs.plataforma) fuenteTexto = conRecuento ? `${rs.recuento} opiniones en ${rs.plataforma}` : `Valoración en ${rs.plataforma}`;
else fuenteTexto = conRecuento ? `${rs.recuento} opiniones de clientes` : 'Opiniones de clientes';
if (negocio.demo) fuenteTexto += ' · de muestra';
const resenas = {
  nota: rs.nota, nota_texto: rs.nota != null ? String(rs.nota.toFixed(1)).replace('.', ',') : '',
  relleno: rs.nota != null ? Math.round(rs.nota / 5 * 1000) / 10 : 0,
  cinco: [1, 2, 3, 4, 5], fuente_texto: fuenteTexto,
  enlace: rs.enlace || null, enlace_texto: rs.plataforma ? 'Ver opiniones en ' + rs.plataforma : 'Ver todas las opiniones',
  citas: rs.citas || []
};
if (modulos.resenas && (rs.nota == null || !resenas.citas.length)) modulos.resenas = false;
if (modulos.preguntas && !(negocio.preguntas || []).length) modulos.preguntas = false;
if (modulos.primera_visita && !(negocio.primera_visita || []).length) modulos.primera_visita = false;

const redesLista = [];
if (negocio.redes && negocio.redes.instagram) redesLista.push({ url: negocio.redes.instagram, nombre: 'Instagram', icono: 'i-instagram' });
if (negocio.redes && negocio.redes.facebook) redesLista.push({ url: negocio.redes.facebook, nombre: 'Facebook', icono: 'i-facebook' });

const heroFoto = foto('media/hero.jpg', negocio.hero_alt || 'Un perro tranquilo en la consulta');

const nombreTieneSector = /veterinari/i.test(negocio.nombre);
const tituloPagina = nombreTieneSector ? `${negocio.nombre} · ${negocio.direccion.localidad}` : `${negocio.nombre} · Clínica veterinaria en ${negocio.direccion.localidad}`;
let descripcion = `${negocio.lema} ${negocio.entradilla}`.replace(/\s+/g, ' ').trim();
if (descripcion.length > 158) descripcion = descripcion.slice(0, 155).replace(/\s\S*$/, '') + '…';

const ogImagen = (negocio.url ? negocio.url.replace(/\/?$/, '/') : '') + 'assets/og.jpg';
const base404 = negocio.url ? new URL(negocio.url).pathname.replace(/\/?$/, '/') : null;

const DIA_SCHEMA = { lunes: 'Monday', martes: 'Tuesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sabado: 'Saturday', domingo: 'Sunday' };
const schema = {
  '@context': 'https://schema.org', '@type': 'VeterinaryCare',
  name: negocio.nombre, description: negocio.lema, telephone: negocio.telefono, email: negocio.email,
  url: negocio.url || undefined, image: ogImagen,
  address: { '@type': 'PostalAddress', streetAddress: negocio.direccion.calle, postalCode: negocio.direccion.cp, addressLocality: negocio.direccion.localidad, addressRegion: negocio.direccion.provincia, addressCountry: 'ES' },
  openingHoursSpecification: DIAS.flatMap(d => (negocio.horario[d] || []).map(([a, b]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DIA_SCHEMA[d], opens: a, closes: b })))
  /* sin aggregateRating ni review a propósito (PLIEGO §1) */
};
const jsonEnScript = o => JSON.stringify(o).replace(/</g, '\\u003c');

const datosJs = {
  zona: 'Europe/Madrid',
  horario: negocio.horario,
  cierres: negocio.cierres || [],
  urgencias: urg.activo ? { etiqueta: urg.etiqueta, telefono: urg.telefono } : null
};

function vistaMarca(m) {
  return {
    slug: m.slug,
    slug_demo: principal.slug,
    personalidad: m.conf.personalidad,
    densidad: m.conf.densidad === 'sobria' ? 'sobria' : 'marca',
    polaridad: m.oscuro ? 'oscuro' : 'claro',
    logo_oscuro: m.conf.logo_en_oscuro === 'original' ? 'original' : 'mono',
    duotono: m.conf.duotono === false ? 'no' : 'si',
    fuentes_url: 'https://fonts.googleapis.com/css2?family=' + m.pareja.display.google + '&family=' + m.pareja.texto.google + '&display=swap',
    logo_vb: vbTexto(m.logo.vb),
    isotipo_vb: vbTexto(m.iso.vb),
    ventana_vb: vbTexto(m.ventana.vb),
    color_tema: m.tokens['--fondo']
  };
}

const sprite = [simbolosEspecies(), ...marcas.map(simbolosMarca)].join('\n');
const largoPalabra = t => Math.max(...t.split(/\s+/).map(p => p.length));

const [, , cvw, cvh] = principal.iso.vb;
const vista = {
  ...negocio,
  modulos,
  marca: vistaMarca(principal),
  robots_no: !negocio.indexar,
  titulo_pagina: tituloPagina,
  descripcion,
  og_imagen: ogImagen,
  base_404: base404,
  tel_href: telHref(negocio.telefono),
  wa, cita, urg,
  como_llegar_url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consultaMapa),
  mapa_embed_url: 'https://www.google.com/maps?q=' + encodeURIComponent(consultaMapa) + '&output=embed',
  h1_n: largoPalabra(negocio.nombre_corto),
  horario_resumen: horarioResumen,
  horario_resumen_corto: horarioResumen.join(' · '),
  horario_hoy_estatico: horarioResumen[0],
  horario_filas: DIAS.map((d, i) => ({ dia: NOMBRE_DIA[d], idx: i + 1, texto: franjasTexto(negocio.horario[d] || []) })),
  especies_lista: especiesLista,
  /* sin foto de hero, la ventana se llena de siluetas: repetidas hasta 40 para
     que con 2 especies no quede media trama vacía */
  trama: Array.from({ length: 40 }, (_, i) => especiesLista[i % especiesLista.length]),
  especies_titulo: negocio.especies_titulo || 'Cada animal, con su tiempo y su manera.',
  especies_cifra_texto: especiesLista.length === 1 ? 'tipo de animal en consulta' : 'tipos de animal en consulta',
  servicios_activos: serviciosActivos,
  primera_visita: (negocio.primera_visita || []).map((p, i) => ({ ...p, num: String(i + 1).padStart(2, '0') })),
  equipo,
  instalaciones_fotos: instalacionesFotos,
  resenas,
  redes_lista: redesLista,
  hero_foto: heroFoto,
  anio_actual: new Date().getFullYear(),
  sprite,
  cortina: {
    vb: vbTexto(principal.iso.vb),
    silueta: principal.iso.silueta,
    hueco: principal.ventana.d,
    hueco_vb: vbTexto(principal.ventana.vb),
    detalles: principal.iso.tipo === 'isotipo' ? principal.iso.detalles : []
  },
  schema_json: jsonEnScript(schema),
  datos_json: jsonEnScript(datosJs),
  mando: {
    marcas: marcas.map(m => ({ slug: m.slug, nombre_corto: m.esPrincipal ? negocio.nombre_corto : (m.conf.nombre_corto || m.slug), pulsado: m.esPrincipal ? 'true' : 'false' })),
    json: jsonEnScript(marcas.map(m => ({
      ...vistaMarca(m),
      hoja: m.esPrincipal ? 'css/marca.css' : 'css/marcas/' + m.slug + '.css',
      nombre: m.esPrincipal ? negocio.nombre : (m.conf.nombre || m.slug),
      nombre_corto: m.esPrincipal ? negocio.nombre_corto : (m.conf.nombre_corto || m.slug),
      h1_n: largoPalabra(m.esPrincipal ? negocio.nombre_corto : (m.conf.nombre_corto || m.slug))
    })))
  }
};

/* ───────────────────────── escribir ───────────────────────── */
if (errores.length && !FORZAR) {
  console.error('\n✗ No se escribe nada. Arregla esto (o --forzar):\n  - ' + errores.join('\n  - ') + '\n');
  process.exit(1);
}

const escritos = [];
function escribir(rel, contenido) {
  fs.mkdirSync(path.dirname(r(rel)), { recursive: true });
  fs.writeFileSync(r(rel), contenido);
  escritos.push(rel);
}

escribir('css/marca.css', cssMarca(principal));
if (existe('css/marcas')) fs.rmSync(r('css/marcas'), { recursive: true });
for (const m of pruebas) escribir('css/marcas/' + m.slug + '.css', cssMarca(m));

const huella = rel => existe(rel) ? crypto.createHash('md5').update(fs.readFileSync(r(rel))).digest('hex').slice(0, 8) : '0';
vista.v = { base: huella('css/base.css'), marca: huella('css/marca.css'), main: huella('js/main.js') };
vista.mando.json = vista.mando.json.replace(/"hoja":"([^"]+)"/g, (m, h) => `"hoja":"${h}?v=${huella(h)}"`);

/* parciales {{> nombre}} → fuente/_nombre.html */
const conParciales = (src, n = 0) => {
  if (n > 5) throw new Error('Parciales anidados demasiado hondo');
  return src.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (m, nombre) => conParciales(leer('fuente/_' + nombre + '.html'), n + 1));
};

const PAGINAS = ['index.html', 'aviso-legal.html', 'privacidad.html', '404.html'];
for (const p of PAGINAS) {
  const datos = { ...vista, pagina: { inicio: p === 'index.html' ? '' : 'index.html' } };
  let html = renderizar(conParciales(leer('fuente/' + p)), datos);
  html = html.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
  escribir(p, html);
}

/* favicon: el isotipo con sus colores */
const [fx, fy, fw, fh] = principal.iso.vb;
const lado = Math.max(fw, fh);
escribir('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fx - (lado - fw) / 2} ${fy - (lado - fh) / 2} ${lado} ${lado}">${principal.iso.original.replace(/var\(--f-display\)/g, 'system-ui, sans-serif').replace(/var\(--peso-display\)/g, '700')}</svg>\n`);

escribir('manifest.json', JSON.stringify({
  name: negocio.nombre, short_name: negocio.nombre_corto, start_url: './', display: 'browser',
  background_color: principal.tokens['--fondo'], theme_color: principal.tokens['--fondo'],
  icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
}, null, 2) + '\n');

if (!existe('.nojekyll')) escribir('.nojekyll', '');

/* informe de contraste legible (y para el README) */
const informeTxt = marcas.map(m => `${m.slug} (${m.conf.personalidad}, ${m.pareja.nombre})\n` +
  m.informe.map(f => `  ${f.ratio >= f.min ? '✓' : '✗'} ${f.uso.padEnd(8)} ${f.texto.padEnd(16)} sobre ${f.fondo.padEnd(12)} ${String(f.ratio).padStart(5)}:1  (mín. ${f.min})`).join('\n')).join('\n\n');
escribir('marca/_contraste.txt', informeTxt + '\n');

log('✓ Escritos: ' + escritos.join(', '));
if (avisos.length) log('\n! Avisos:\n  - ' + avisos.join('\n  - '));
if (errores.length) log('\n✗ Errores ignorados por --forzar:\n  - ' + errores.join('\n  - '));
log('\n' + informeTxt);

/* ───────────────────────── og:image ───────────────────────── */
if (!SIN_OG) {
  try {
    const { generarOg } = await import(pathToFileURL(r('scripts/og.mjs')).href);
    await generarOg(RAIZ);
    log('✓ assets/og.jpg');
  } catch (e) {
    log('! og:image no generada (' + e.message.split('\n')[0] + '). Vuelve a ejecutar sin --sin-og cuando esté Playwright.');
  }
}
