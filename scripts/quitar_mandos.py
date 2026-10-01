"""quitar_mandos.py — quita los tres mandos de maqueta (versión, paleta, marca)
antes de entregar la web a un cliente. NUNCA viajan al sitio de un cliente.

  python scripts/quitar_mandos.py             quita y vuelve a aplicar la marca
  python scripts/quitar_mandos.py --comprobar  lo prueba en una copia temporal y
                                               no toca nada de esta carpeta

Qué hace:
  1. En fuente/*.html, css/base.css y js/main.js borra cada bloque entre una
     línea con «[MANDO DE MAQUETA] inicio» y otra con «[MANDO DE MAQUETA] fin»
     (ambas incluidas). Se niega a escribir si las marcas no cuadran o si un
     archivo pierde más líneas de las que suman sus bloques.
  2. Borra css/marcas/ y marca/pruebas/ (las marcas de prueba no son del cliente).
  3. Ejecuta node scripts/aplicar.mjs para regenerar las páginas.

La versión elegida en la reunión NO se pierde: se fija en marca/marca.json
(«densidad»: "marca" | "sobria"; los colores de una paleta alternativa se
copian a «colores»). Ver RESKIN.md §8.
"""
import os, re, shutil, subprocess, sys, tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INICIO, FIN = '[MANDO DE MAQUETA] inicio', '[MANDO DE MAQUETA] fin'

def archivos(raiz):
    out = [os.path.join(raiz, 'css', 'base.css'), os.path.join(raiz, 'js', 'main.js')]
    fuente = os.path.join(raiz, 'fuente')
    out += [os.path.join(fuente, n) for n in sorted(os.listdir(fuente)) if n.endswith('.html')]
    return out

def quitar_bloques(texto, nombre):
    # conserva los finales de línea tal cual (CRLF o LF): nada de reemplazos con '\n' literal
    lineas = texto.splitlines(keepends=True)
    fuera, dentro, quitadas, bloques = [], False, 0, 0
    for n, l in enumerate(lineas, 1):
        if INICIO in l:
            if dentro:
                raise SystemExit('✗ %s:%d abre un bloque de mando sin cerrar el anterior' % (nombre, n))
            dentro, bloques = True, bloques + 1
        if dentro:
            quitadas += 1
            if FIN in l:
                dentro = False
            continue
        if FIN in l:
            raise SystemExit('✗ %s:%d cierra un bloque de mando que no se abrió' % (nombre, n))
        fuera.append(l)
    if dentro:
        raise SystemExit('✗ %s: bloque de mando sin cerrar' % nombre)
    if len(fuera) != len(lineas) - quitadas:
        raise SystemExit('✗ %s: se perderían más líneas de las marcadas; no se escribe nada' % nombre)
    return ''.join(fuera), bloques, quitadas

def quitar(raiz, aplicar=True):
    cambios = []
    for ruta in archivos(raiz):
        with open(ruta, encoding='utf-8', newline='') as f:
            texto = f.read()
        nuevo, bloques, quitadas = quitar_bloques(texto, os.path.relpath(ruta, raiz))
        if bloques:
            with open(ruta, 'w', encoding='utf-8', newline='') as f:
                f.write(nuevo)
            cambios.append('%s: %d bloque(s), %d líneas' % (os.path.relpath(ruta, raiz).replace('\\', '/'), bloques, quitadas))
    for d in ('css/marcas', 'marca/pruebas'):
        p = os.path.join(raiz, d)
        if os.path.isdir(p):
            shutil.rmtree(p)
            cambios.append(d + '/ borrada')
    if aplicar:
        subprocess.run(['node', os.path.join(raiz, 'scripts', 'aplicar.mjs'), '--sin-og', '--silencio'], check=True, cwd=raiz)
    return cambios

def comprobar():
    tmp = tempfile.mkdtemp(prefix='quitar-mandos-')
    copia = os.path.join(tmp, 'web')
    ignorar = shutil.ignore_patterns('screenshots', '_scratch', '.git', 'node_modules')
    shutil.copytree(RAIZ, copia, ignore=ignorar)
    try:
        cambios = quitar(copia)
        problemas = []
        for ruta in archivos(copia) + [os.path.join(copia, n) for n in ('index.html', 'privacidad.html', 'aviso-legal.html', '404.html')]:
            t = open(ruta, encoding='utf-8').read()
            if 'MANDO DE MAQUETA' in t:
                problemas.append(os.path.relpath(ruta, copia) + ' conserva marcas del mando')
        index = open(os.path.join(copia, 'index.html'), encoding='utf-8').read()
        for patron in ('id="mando"', 'data-cambiar-marca', 'mando-marcas', '?revision'):
            if patron in index:
                problemas.append('index.html conserva «%s»' % patron)
        css = open(os.path.join(copia, 'css', 'base.css'), encoding='utf-8').read()
        if re.search(r'^\.mando\b', css, re.M):
            problemas.append('base.css conserva reglas .mando')
        if 'densidad-sobria' not in css:
            problemas.append('base.css perdió la versión sobria (no es del mando: es una opción de marca.json)')
        if os.path.isdir(os.path.join(copia, 'css', 'marcas')):
            problemas.append('css/marcas sigue ahí')
        r = subprocess.run(['node', '--check', os.path.join(copia, 'js', 'main.js')], capture_output=True, text=True)
        if r.returncode:
            problemas.append('main.js no compila: ' + r.stderr.strip())
        print('Cambios en la copia:\n  ' + '\n  '.join(cambios))
        if problemas:
            print('\n✗ La receta de borrado falla:\n  ' + '\n  '.join(problemas))
            return 1
        print('\n✓ La receta de borrado funciona (comprobada en una copia; esta carpeta no se ha tocado).')
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--comprobar' in sys.argv:
        sys.exit(comprobar())
    print('\n'.join(quitar(RAIZ)))
    print('✓ Mandos quitados y web regenerada. Comprueba con: node scripts/verificar.mjs --rapido')
