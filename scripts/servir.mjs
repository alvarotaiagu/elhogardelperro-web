/* Servidor estático para revisar la plantilla en el navegador.
   Sirve la carpeta en la raíz Y bajo el prefijo de GitHub Pages
   (/plantilla-veterinaria-web/…), para probar la 404 como en Pages.

   node scripts/servir.mjs          → http://127.0.0.1:4191
   node scripts/servir.mjs 5000     → otro puerto
   Con ?revision al final se ven los mandos de maqueta. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8'
};

export function crearServidor(raizDada, prefijo) {
  const raiz = path.resolve(raizDada);
  return http.createServer((req, res) => {
    let limpia = decodeURIComponent(req.url.split('?')[0]);
    if (prefijo && limpia.startsWith(prefijo)) limpia = '/' + limpia.slice(prefijo.length);
    const destino = path.join(raiz, limpia === '/' ? 'index.html' : limpia);
    if (!destino.startsWith(raiz)) { res.writeHead(403).end('no'); return; }
    if (!fs.existsSync(destino) || fs.statSync(destino).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(raiz, '404.html')));
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(destino)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(destino));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const puerto = Number(process.argv[2]) || 4191;
  let prefijo = null;
  try { prefijo = new URL(JSON.parse(fs.readFileSync(path.join(raiz, 'negocio.json'), 'utf8')).url).pathname; } catch (e) {}
  crearServidor(raiz, prefijo).listen(puerto, '127.0.0.1', () => {
    console.log('Plantilla en http://127.0.0.1:' + puerto + '/  (mandos: /?revision)');
    if (prefijo) console.log('También bajo el prefijo de Pages: http://127.0.0.1:' + puerto + prefijo);
  });
}
