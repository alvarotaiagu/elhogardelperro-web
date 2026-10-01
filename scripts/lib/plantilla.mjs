/* Mustache mínimo, sin dependencias.
     {{campo}}            texto escapado        {{a.b.c}}  ruta con puntos
     {{{campo}}}          HTML tal cual         {{.}}      el elemento actual
     {{#campo}}…{{/campo}}  si es lista, repite; si es verdadero, pinta una vez
     {{^campo}}…{{/campo}}  pinta si es falso, vacío o lista vacía
     {{! comentario }}    no sale
   Una clave que no existe en ningún contexto es un ERROR, no un hueco: así un
   campo mal escrito en negocio.json no produce una web con agujeros. */

const escapar = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function buscar(pila, ruta, estricto) {
  if (ruta === '.') return pila[pila.length - 1];
  const partes = ruta.split('.');
  for (let i = pila.length - 1; i >= 0; i--) {
    const ctx = pila[i];
    if (ctx !== null && typeof ctx === 'object' && partes[0] in ctx) {
      let v = ctx;
      for (const p of partes) v = v == null ? undefined : v[p];
      return v;
    }
  }
  if (estricto) throw new Error('Plantilla: no existe el campo «' + ruta + '»');
  return undefined;
}

const vacio = v => v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && v.length === 0);

function trocear(src) {
  const re = /\{\{(\{|#|\^|\/|!)?\s*([^}]*?)\s*\}?\}\}/g;
  const raiz = { hijos: [] };
  const pila = [raiz];
  let ultimo = 0, m;
  while ((m = re.exec(src))) {
    const actual = pila[pila.length - 1];
    if (m.index > ultimo) actual.hijos.push({ tipo: 'texto', v: src.slice(ultimo, m.index) });
    ultimo = re.lastIndex;
    const [, marca, nombre] = m;
    if (marca === '!') continue;
    if (marca === '#' || marca === '^') {
      const nodo = { tipo: marca === '#' ? 'seccion' : 'inversa', nombre, hijos: [] };
      actual.hijos.push(nodo);
      pila.push(nodo);
    } else if (marca === '/') {
      const abierto = pila.pop();
      if (!abierto || abierto.nombre !== nombre) throw new Error('Plantilla: cierre {{/' + nombre + '}} sin abrir (abierto: ' + (abierto && abierto.nombre) + ')');
    } else {
      actual.hijos.push({ tipo: marca === '{' ? 'crudo' : 'var', nombre });
    }
  }
  if (pila.length !== 1) throw new Error('Plantilla: sección sin cerrar «' + pila[pila.length - 1].nombre + '»');
  if (ultimo < src.length) raiz.hijos.push({ tipo: 'texto', v: src.slice(ultimo) });
  return raiz.hijos;
}

function pintar(nodos, pila) {
  let out = '';
  for (const n of nodos) {
    if (n.tipo === 'texto') out += n.v;
    else if (n.tipo === 'var' || n.tipo === 'crudo') {
      const v = buscar(pila, n.nombre, true);
      if (v === undefined || v === null) throw new Error('Plantilla: el campo «' + n.nombre + '» está vacío');
      out += n.tipo === 'var' ? escapar(v) : String(v);
    } else if (n.tipo === 'seccion') {
      const v = buscar(pila, n.nombre, false);
      if (vacio(v)) continue;
      if (Array.isArray(v)) v.forEach((item, i) => { out += pintar(n.hijos, pila.concat([{ '@i': i + 1, '@primero': i === 0, '@ultimo': i === v.length - 1 }, item])); });
      else out += pintar(n.hijos, typeof v === 'object' ? pila.concat([v]) : pila);
    } else if (n.tipo === 'inversa') {
      if (vacio(buscar(pila, n.nombre, false))) out += pintar(n.hijos, pila);
    }
  }
  return out;
}

export function renderizar(src, datos) {
  return pintar(trocear(src), [datos]);
}
