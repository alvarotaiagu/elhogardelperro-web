/* ═══════════════════════════════════════════════════════════════════════════
   Plantilla veterinaria · «La marca manda»
   El isotipo del cliente es el motivo: se dibuja en la cortina y la página
   aparece a través de él; en el hero es la ventana de la foto, que crece con
   el scroll hasta llenar la pantalla; late en el «abierto ahora».

   Este archivo NO sabe nada de ninguna marca: lee los viewBox y los ids del
   HTML que escribe scripts/aplicar.mjs. Si aquí aparece un nombre o un color,
   es un fallo (lo caza scripts/verificar.mjs).

   Banderas separadas a propósito:
     gsapReady  → hay motor de animación (GSAP + ScrollTrigger cargados)
     movimiento → además el usuario NO ha pedido reducir el movimiento
   Con movimiento reducido el CONTENIDO sigue cambiando (estado en vivo,
   contadores, día de hoy); lo que se apaga es el viaje.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esTactil = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var gsapReady = !!(window.gsap && window.ScrollTrigger);
  var movimiento = gsapReady && !reduce;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;

  if (gsapReady) gsap.registerPlugin(ST);
  if (movimiento) html.classList.add('con-movimiento');

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function css(nombre) { return getComputedStyle(html).getPropertyValue(nombre).trim(); }
  function easeEntrada() { return css('--ease-entrada') || 'expo.out'; }
  function alturaCabecera() { return parseFloat(css('--cab')) || 78; }
  function esSobria() { return html.classList.contains('densidad-sobria'); }
  function slug() { return html.getAttribute('data-marca'); }
  function refrescar() { if (gsapReady) ST.refresh(); }

  function cuandoVisible(nodos, umbral, alEntrar) {
    if (!('IntersectionObserver' in window)) { nodos.forEach(alEntrar); return; }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        alEntrar(en.target);
      });
    }, { threshold: umbral });
    nodos.forEach(function (n) { obs.observe(n); });
  }

  /* ───────────────────────── Lenis ───────────────────────── */
  var lenis = null;
  if (movimiento && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function irA(destino) {
    var desfase = -alturaCabecera() + 1;
    if (lenis) { lenis.scrollTo(destino, { offset: desfase, duration: 1.5 }); return; }
    var el = typeof destino === 'string' ? $(destino) : destino;
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset + desfase);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    var id = href.slice(href.indexOf('#'));
    var mismaPagina = href.charAt(0) === '#' || href.split('#')[0] === '' ;
    if (!mismaPagina || id === '#' || !$(id)) return;
    e.preventDefault();
    cerrarMenu();
    irA(id);
  });

  /* ───────────────────── titulares partidos ───────────────────── */
  function partir(el) {
    var modo = el.dataset.revelar;
    var texto = el.textContent.trim();
    var palabras = texto.split(/\s+/);
    el.setAttribute('aria-label', texto);
    el.textContent = '';
    var piezas = [];
    palabras.forEach(function (palabra, i) {
      var caja = document.createElement('span');
      caja.className = 'palabra';
      caja.setAttribute('aria-hidden', 'true');
      if (modo === 'letras') {
        Array.from(palabra).forEach(function (c) {
          var s = document.createElement('span');
          s.className = 'letra';
          s.textContent = c;
          caja.appendChild(s);
          piezas.push(s);
        });
      } else {
        var s = document.createElement('span');
        s.className = 'palabra-int';
        s.textContent = palabra;
        caja.appendChild(s);
        piezas.push(s);
      }
      el.appendChild(caja);
      if (i < palabras.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return piezas;
  }

  function revelar(el, piezas) {
    /* y:0 explícito: el estado vacío viene del CSS en translate3d (PLIEGO §6) */
    gsap.to(piezas, { y: 0, yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: el.dataset.revelar === 'letras' ? 0.03 : 0.07 });
  }

  $$('[data-revelar]').forEach(function (el) {
    var piezas = partir(el);
    if (!movimiento) return;
    if (el.closest('.hero')) {
      document.addEventListener('cortina-retirada', function () { revelar(el, piezas); }, { once: true });
      return;
    }
    /* una sola vez: IntersectionObserver, nunca ScrollTrigger once:true */
    cuandoVisible([el], 0.3, function () { revelar(el, piezas); });
  });

  /* El CSS calcula el tamaño del nombre con el ancho medio de la pareja; aquí se
     afina con la medida real: si la palabra más larga no cabe, se reduce. Sin JS
     queda el cálculo del CSS, que va con margen. */
  function ajustarTitulo() {
    var h1 = $('#hero-titulo');
    if (!h1) return;
    h1.style.removeProperty('font-size');
    var tam = parseFloat(getComputedStyle(h1).fontSize);
    for (var i = 0; i < 40 && h1.scrollWidth > h1.clientWidth + 1 && tam > 28; i++) {
      tam *= 0.96;
      h1.style.fontSize = tam.toFixed(1) + 'px';
    }
  }
  ajustarTitulo();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarTitulo);

  /* cambia el texto de un titular ya partido (mando de marca) y lo deja visible */
  function reescribir(el, texto) {
    el.textContent = texto;
    var piezas = partir(el);
    if (gsapReady) gsap.set(piezas, { y: 0, yPercent: 0 });
  }

  /* ───────────── cortina: el isotipo se dibuja y la página aparece dentro ───────────── */
  (function cortina() {
    var cort = $('#cortina');
    if (!cort) return;
    var hecho = false;

    function retirar() {
      if (hecho) return;
      hecho = true;
      cort.classList.add('fuera');
      document.body.style.removeProperty('overflow');
      if (lenis) lenis.start();
      refrescar();
      document.dispatchEvent(new CustomEvent('cortina-retirada'));
    }

    if (!movimiento) {
      /* sin GSAP o con movimiento reducido se retira igual: nunca tapa la página */
      setTimeout(retirar, reduce ? 300 : 120);
      return;
    }

    /* red de seguridad: pase lo que pase, a los 6,5 s la cortina se va */
    setTimeout(retirar, 6500);

    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();

    var lienzo = $('#cortina-lienzo');
    var hueco = $('#cortina-hueco');
    var circulo = $('#cortina-circulo');
    var iso = $('#cortina-isotipo');
    var relleno = $('.cortina__relleno', cort);
    var trazos = $$('.cortina__trazo', cort);
    var nombre = $('.cortina__nombre', cort);
    var vbH = (cort.getAttribute('data-vb-hueco') || '0 0 100 100').split(/\s+/).map(Number);
    var w = 0, h = 0, caja = null;
    var estado = { k: 1, r: 0 };

    function medir() {
      w = window.innerWidth; h = window.innerHeight;
      lienzo.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      caja = iso.getBoundingClientRect();
      pintar();
    }
    function pintar() {
      if (!caja) return;
      /* el hueco ocupa exactamente el sitio del isotipo dibujado y crece desde ahí */
      var cx = caja.left + caja.width / 2, cy = caja.top + caja.height / 2;
      var s = Math.min(caja.width / vbH[2], caja.height / vbH[3]) * estado.k;
      hueco.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + s + ') translate(' + -(vbH[0] + vbH[2] / 2) + ' ' + -(vbH[1] + vbH[3] / 2) + ')');
      circulo.setAttribute('cx', cx); circulo.setAttribute('cy', cy); circulo.setAttribute('r', estado.r);
    }

    function empezar() {
      medir();
      window.addEventListener('resize', medir);
      var diag = Math.hypot(w, h);
      var kFinal = (Math.max(w, h) / Math.max(caja.width, 1)) * 2.6;
      hueco.setAttribute('transform', 'scale(0)');

      var tl = gsap.timeline({ onComplete: retirar });
      /* autoRound:false o, con pathLength=1, GSAP redondea y el trazo salta de 1 a 0 */
      tl.to(trazos, { strokeDashoffset: 0, duration: 1.15, ease: 'power2.inOut', stagger: 0.12, autoRound: false }, 0)
        .to(nombre, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.35)
        .to(relleno, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 1.05)
        .add(function () { pintar(); gsap.set(iso, { opacity: 0 }); }, 1.5)
        .to(nombre, { opacity: 0, duration: 0.3 }, 1.4)
        .to(estado, { k: kFinal, duration: 1.35, ease: 'expo.inOut', onUpdate: pintar }, 1.5)
        .to(estado, { r: diag * 0.62, duration: 0.95, ease: 'power3.in', onUpdate: pintar }, 1.85);
    }

    /* las medidas del isotipo dependen de las fuentes (el nombre de debajo) */
    if (document.fonts && document.fonts.ready) {
      var arrancado = false;
      var arrancar = function () { if (!arrancado) { arrancado = true; empezar(); } };
      document.fonts.ready.then(arrancar);
      setTimeout(arrancar, 900);
    } else empezar();
  })();

  /* ───────────────── hero: la foto dentro del isotipo, que crece al bajar ───────────────── */
  var hero = (function () {
    var seccion = $('#inicio');
    var caja = $('#ventana-hero');
    var recorte = $('#ventana-recorte');
    var texto = $('.hero__texto');
    if (!seccion || !caja || !recorte) return { montar: function () {}, desmontar: function () {} };

    var capa = null, disparo = null, entrada = { e: 0 }, prog = { p: 0 };
    var w0 = null, vb = null, img = null, forma = null, circulo = null, contorno = null;
    var entradaHecha = false;

    function vbVentana() {
      var sv = $('#ventana-contorno');
      return (sv ? sv.getAttribute('viewBox') : '0 0 100 100').split(/\s+/).map(Number);
    }

    function medir() {
      w0 = { x: caja.offsetLeft, y: caja.offsetTop, w: caja.offsetWidth, h: caja.offsetHeight };
      vb = vbVentana();
    }

    function pintar() {
      if (!capa || !w0) return;
      var W = seccion.clientWidth, H = seccion.clientHeight;
      var p = prog.p, e = entrada.e;
      var cx0 = w0.x + w0.w / 2, cy0 = w0.y + w0.h / 2;
      var cx = cx0 + (W / 2 - cx0) * p, cy = cy0 + (H / 2 - cy0) * p;
      var cubrir = Math.max(W / w0.w, H / w0.h) * 2.2;
      var escala = (w0.w / vb[2]) * (1 + (cubrir - 1) * p * p) * (0.35 + 0.65 * e);
      var tr = 'translate(' + cx + ' ' + cy + ') scale(' + escala + ') translate(' + -(vb[0] + vb[2] / 2) + ' ' + -(vb[1] + vb[3] / 2) + ')';
      forma.setAttribute('transform', tr);
      if (contorno) {
        /* el filete desplazado de la versión quieta, que se queda atrás al crecer */
        var d = parseFloat(css('--contorno-desfase')) || 0;
        contorno.setAttribute('transform', 'translate(' + d + ' ' + d + ') ' + tr);
        contorno.style.opacity = String(Math.max(0, 1 - p * 3) * e);
      }
      var r = p < 0.45 ? 0 : Math.hypot(W, H) * 0.6 * Math.pow((p - 0.45) / 0.55, 1.6);
      circulo.setAttribute('cx', W / 2); circulo.setAttribute('cy', H / 2); circulo.setAttribute('r', r);

      /* la foto cubre la ventana al principio y la pantalla al final */
      /* la foto llega a cubrir el hero entero antes que el recorte (q va por
         delante de p): si no, a mitad de camino se ve el fondo por los bordes */
      var q = Math.min(1, p / 0.4);
      q = 1 - Math.pow(1 - q, 2);
      var s0 = Math.max(w0.w / W, w0.h / H);
      var s = s0 + (1 - s0) * q;
      var tx = (cx0 - s0 * W / 2) * (1 - q), ty = (cy0 - s0 * H / 2) * (1 - q);
      /* en la entrada la foto llega un poco acercada; el zoom se hace desde su centro */
      var s2 = s * (1 + (1 - e) * 0.25);
      tx -= (s2 - s) * W / 2; ty -= (s2 - s) * H / 2;
      img.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + s2.toFixed(4) + ')';
      if (texto) { texto.style.opacity = String(Math.max(0, 1 - p * 2.4)); texto.style.transform = 'translate3d(0,' + (-60 * p) + 'px,0)'; }
    }

    function montar() {
      desmontar();
      if (!movimiento || esSobria() || window.innerWidth <= 900) return;
      medir();
      var s = slug();
      var clip = $('#ventana-viva-' + s);
      if (!clip) return;
      forma = $('[data-ventana-viva]', clip);
      /* un círculo que crece al final garantiza que se llena la pantalla aunque
         el isotipo tenga entrantes o sea alargado */
      circulo = $('circle', clip);
      if (!circulo) { circulo = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circulo.setAttribute('r', '0'); clip.appendChild(circulo); }

      capa = document.createElement('div');
      capa.className = 'hero__viva';
      capa.setAttribute('aria-hidden', 'true');
      var copia = recorte.cloneNode(true);
      copia.removeAttribute('id');
      $$('[id]', copia).forEach(function (n) { n.removeAttribute('id'); });
      copia.style.clipPath = 'url(#ventana-viva-' + s + ')';
      capa.appendChild(copia);
      var lienzo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lienzo.setAttribute('class', 'hero__viva-contorno');
      contorno = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      contorno.setAttribute('d', forma.getAttribute('d'));
      lienzo.appendChild(contorno);
      capa.insertBefore(lienzo, copia);
      seccion.insertBefore(capa, seccion.firstChild);
      img = copia.querySelector('.ventana__img, .ventana__trama');
      seccion.classList.add('hero--viva');
      if (entradaHecha) entrada.e = 1;
      pintar();

      disparo = ST.create({
        trigger: seccion,
        start: 'top top',
        end: '+=110%',
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: function () { medir(); pintar(); },
        onUpdate: function (self) { prog.p = self.progress; pintar(); }
      });
    }

    function desmontar() {
      if (disparo) { disparo.kill(true); disparo = null; }
      if (capa) { capa.remove(); capa = null; }
      seccion.classList.remove('hero--viva');
      if (texto) { texto.style.removeProperty('opacity'); texto.style.removeProperty('transform'); }
      prog.p = 0;
    }

    document.addEventListener('cortina-retirada', function () {
      entradaHecha = true;
      if (!capa) { entrada.e = 1; return; }
      gsap.fromTo(entrada, { e: 0 }, { e: 1, duration: 1.5, ease: easeEntrada(), onUpdate: pintar, immediateRender: false });
    }, { once: true });

    montar();
    return { montar: montar, desmontar: desmontar };
  })();

  /* ───────────────── estado en vivo: abierto / cerrado ───────────────── */
  var datos = {};
  try { datos = JSON.parse(($('#datos-negocio') || {}).textContent || '{}'); } catch (e) {}
  var CLAVES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var aMin = function (hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; };
  var hora = function (hhmm) { return hhmm.replace(/^0/, ''); };

  function ahora(fecha) {
    var partes = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: datos.zona || 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(fecha).forEach(function (p) { partes[p.type] = p.value; });
    var y = +partes.year, m = +partes.month, d = +partes.day;
    return { y: y, m: m, d: d, iso: partes.year + '-' + partes.month + '-' + partes.day, dia: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), min: +partes.hour * 60 + +partes.minute };
  }
  function sumarDias(a, n) {
    var f = new Date(Date.UTC(a.y, a.m - 1, a.d + n));
    var iso = f.toISOString().slice(0, 10);
    return { iso: iso, dia: f.getUTCDay(), d: f.getUTCDate(), m: f.getUTCMonth() + 1 };
  }
  function cierreDe(iso) {
    return (datos.cierres || []).filter(function (c) { return c.desde <= iso && iso <= c.hasta; })[0] || null;
  }
  function franjasDe(iso, dia) {
    if (cierreDe(iso)) return [];
    return ((datos.horario || {})[CLAVES[dia]]) || [];
  }

  function calcularEstado(fecha) {
    var a = ahora(fecha);
    var cierre = cierreDe(a.iso);
    var hoy = franjasDe(a.iso, a.dia);
    for (var i = 0; i < hoy.length; i++) {
      if (a.min >= aMin(hoy[i][0]) && a.min < aMin(hoy[i][1])) {
        return { abierto: true, texto: 'Abierto ahora · cierra a las ' + hora(hoy[i][1]), hoy: hoy, a: a };
      }
    }
    var base = cierre ? 'Cerrado por ' + cierre.motivo.toLowerCase() + ' · ' : 'Cerrado · ';
    for (var j = 0; j < hoy.length; j++) {
      if (aMin(hoy[j][0]) > a.min) return { abierto: false, texto: base + 'abre a las ' + hora(hoy[j][0]), hoy: hoy, a: a };
    }
    for (var n = 1; n <= 21; n++) {
      var sig = sumarDias(a, n);
      var f = franjasDe(sig.iso, sig.dia);
      if (!f.length) continue;
      var cuando = n === 1 ? 'mañana' : (n < 7 ? 'el ' + NOMBRES[sig.dia] : 'el ' + sig.d + '/' + sig.m);
      return { abierto: false, texto: base + 'abre ' + cuando + ' a las ' + hora(f[0][0]), hoy: hoy, a: a, cierre: cierre };
    }
    return { abierto: false, texto: 'Cerrado', hoy: hoy, a: a, cierre: cierre };
  }

  function pintarEstado() {
    if (!datos.horario) return;
    var e = calcularEstado(new Date());
    $$('[data-estado]').forEach(function (el) {
      el.setAttribute('data-abierto', e.abierto ? 'si' : 'no');
      var t = $('[data-estado-texto]', el);
      if (t) t.textContent = e.texto;
    });
    var idx = e.a.dia === 0 ? 7 : e.a.dia;
    $$('.horario tr[data-dia]').forEach(function (tr) { tr.classList.toggle('es-hoy', +tr.getAttribute('data-dia') === idx); });
    var franjas = $('[data-hoy-franjas]');
    if (franjas) {
      var cierre = cierreDe(e.a.iso);
      franjas.textContent = e.hoy.length ? e.hoy.map(function (f) { return hora(f[0]) + '–' + hora(f[1]); }).join(' y ')
        : (cierre ? 'Cerrado (' + cierre.motivo.toLowerCase() + ')' : 'Cerrado hoy');
    }
  }
  pintarEstado();
  setInterval(pintarEstado, 30000);
  /* para los tests: el estado a una hora cualquiera sin tocar el reloj */
  window.__estadoClinica = function (iso, otros) {
    var propios = datos;
    if (otros) datos = otros;
    try { return calcularEstado(new Date(iso)); } finally { datos = propios; }
  };

  /* ───────────────── cinta infinita, más rápida al hacer scroll ───────────────── */
  (function cinta() {
    var pista = $('#cinta-pista');
    if (!pista) return;
    var grupo = pista.firstElementChild;
    var copias = Math.ceil((window.innerWidth * 2) / Math.max(1, grupo.offsetWidth)) + 1;
    for (var i = 0; i < copias; i++) {
      var c = grupo.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      pista.appendChild(c);
    }
    if (!movimiento) return;
    var x = 0, base = 0.55, extra = 0;
    if (lenis) lenis.on('scroll', function (e) { extra = Math.min(Math.abs(e.velocity || 0) * 0.35, 9); });
    /* rAF propio: ningún tween de GSAP toca esta propiedad (memoria «tween que pisa el tick») */
    (function paso() {
      if (!esSobria()) {
        var ancho = grupo.offsetWidth;
        x -= base + extra;
        extra *= 0.92;
        if (ancho && x <= -ancho) x += ancho;
        pista.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      }
      requestAnimationFrame(paso);
    })();
  })();

  /* ───────────────── servicios: pila anclada ───────────────── */
  var pila = (function () {
    var lista = $('#pila');
    var items = $$('.pila__item');
    if (!lista || !items.length) return { montar: function () {} };
    var disparos = [];

    /* Todas miden lo que la más alta: condición para que la pila no se deshaga.
       Se mide el contenido real, nunca la pantalla (nada de «divs gigantes»). */
    function igualar() {
      var tarjetas = items.map(function (it) { return $('.tarjeta', it); });
      lista.style.removeProperty('--alto-tarjeta');
      if (getComputedStyle(items[0]).position !== 'sticky') return;
      tarjetas.forEach(function (t) { t.style.height = 'auto'; });
      var alto = Math.max.apply(null, tarjetas.map(function (t) { return t.offsetHeight; }));
      tarjetas.forEach(function (t) { t.style.removeProperty('height'); });
      lista.style.setProperty('--alto-tarjeta', alto + 'px');
    }

    function montar() {
      igualar();
      disparos.forEach(function (d) { d.kill(); });
      disparos = [];
      items.forEach(function (it) {
        var t = $('.tarjeta', it);
        if (gsapReady) gsap.set(t, { clearProps: 'transform' });
        t.style.removeProperty('--oscuro');
      });
      if (!movimiento || getComputedStyle(items[0]).position !== 'sticky') return;
      var tope = alturaCabecera() + window.innerHeight * 0.03;
      items.forEach(function (it, i) {
        var siguiente = items[i + 1];
        if (!siguiente) return;
        var tarjeta = $('.tarjeta', it);
        var tw = gsap.fromTo(tarjeta, { scale: 1, '--oscuro': 0 }, { scale: 0.93, '--oscuro': 0.22, ease: 'none', paused: true, immediateRender: false });
        disparos.push(ST.create({
          trigger: siguiente,
          start: 'top bottom',
          end: 'top ' + Math.round(tope) + 'px',          /* acaba justo cuando la siguiente se posa */
          scrub: true,
          animation: tw
        }));
      });
    }

    montar();
    return { montar: montar };
  })();

  /* ───────────────── primera visita: la línea avanza y enciende los pasos ───────────────── */
  (function pasos() {
    var lista = $('.pasos');
    if (!lista) return;
    var todos = $$('.paso', lista);
    if (!movimiento) { todos.forEach(function (p) { p.classList.add('encendido'); }); return; }
    lista.style.setProperty('--avance', '0');
    ST.create({
      trigger: lista,
      start: 'top 78%',
      end: 'bottom 55%',
      scrub: 0.5,
      onUpdate: function (self) {
        lista.style.setProperty('--avance', self.progress.toFixed(3));
        todos.forEach(function (p, i) { p.classList.toggle('encendido', self.progress >= (todos.length > 1 ? i / (todos.length - 1) : 0) - 0.02); });
      }
    });
  })();

  /* ───────────────── contadores ───────────────── */
  (function contadores() {
    var nodos = $$('[data-contador]');
    function formatear(n, el) {
      var dec = parseInt(el.dataset.decimales || '0', 10);
      return dec ? n.toFixed(dec).replace('.', ',') : Math.round(n).toString();
    }
    if (movimiento) nodos.forEach(function (el) { el.textContent = formatear(0, el); });
    cuandoVisible(nodos, 0.5, function (el) {
      var fin = parseFloat(el.dataset.contador);
      /* con movimiento reducido el dato aparece igual: se pone, no se anima */
      if (!movimiento) { el.textContent = formatear(fin, el); return; }
      var estado = { v: 0 };
      gsap.to(estado, {
        v: fin, duration: 1.6, ease: 'power2.out',
        onUpdate: function () { el.textContent = formatear(estado.v, el); },
        onComplete: function () { el.textContent = formatear(fin, el); }
      });
    });
  })();

  /* ───────────────── apariciones ───────────────── */
  function escalonar(selector, paso) {
    var nodos = $$(selector);
    cuandoVisible(nodos, 0.2, function (n) {
      var hermanos = Array.prototype.indexOf.call(n.parentNode.children, n);
      setTimeout(function () { n.classList.add('visible'); }, movimiento ? Math.max(hermanos, 0) * paso : 0);
    });
  }
  escalonar('.especie', 70);
  escalonar('.persona', 120);
  escalonar('.cita', 0);
  cuandoVisible($$('.lamina'), 0.2, function (n) { n.classList.add('visible'); });

  /* ───────────────── botones magnéticos ───────────────── */
  (function imanes() {
    if (!movimiento || esTactil) return;
    $$('.iman').forEach(function (el) {
      var aX = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3.out' });
      var aY = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var c = el.getBoundingClientRect();
        aX((e.clientX - (c.left + c.width / 2)) * 0.28);
        aY((e.clientY - (c.top + c.height / 2)) * 0.38);
      });
      el.addEventListener('pointerleave', function () { aX(0); aY(0); });
    });
  })();

  /* ───────────────── cursor propio: punto + aro; sobre «pedir cita», el isotipo ───────────────── */
  var cursorIso = null;
  (function cursor() {
    if (!movimiento || esTactil) return;
    var c = document.createElement('div');
    var p = document.createElement('div');
    c.className = 'cursor';
    p.className = 'cursor-punto';
    var fuente = $('[data-vb="isotipo"]');
    c.innerHTML = '<svg class="cursor__isotipo" viewBox="' + (fuente ? fuente.getAttribute('viewBox') : '0 0 100 100') + '" data-vb="isotipo"><use href="#isotipo-mono-' + slug() + '" data-uso="isotipo-mono"/></svg>';
    cursorIso = c.firstChild;
    [c, p].forEach(function (n) { n.setAttribute('aria-hidden', 'true'); document.body.appendChild(n); });

    var aX = gsap.quickTo(c, 'x', { duration: 0.28, ease: 'power3.out' });
    var aY = gsap.quickTo(c, 'y', { duration: 0.28, ease: 'power3.out' });
    function mostrar(si) { c.classList.toggle('cursor--vivo', si); p.classList.toggle('cursor--vivo', si); }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (!c.classList.contains('cursor--vivo')) {
        gsap.set(c, { x: e.clientX, y: e.clientY });
        html.classList.add('con-cursor');        /* el del sistema se oculta solo cuando el propio ya se ve */
        mostrar(true);
      }
      gsap.set(p, { x: e.clientX, y: e.clientY });
      aX(e.clientX); aY(e.clientY);
    });
    html.addEventListener('mouseleave', function () { mostrar(false); });
    html.addEventListener('mouseenter', function () { if (html.classList.contains('con-cursor')) mostrar(true); });
    document.addEventListener('pointerover', function (e) {
      var sobre = !!e.target.closest('a, button, summary, .especie, .lamina');
      var cita = !!e.target.closest('.boton--cita');
      c.classList.toggle('cursor--activo', sobre);
      c.classList.toggle('cursor--cita', cita);
      p.classList.toggle('cursor-punto--activo', sobre);
    });
  })();

  /* ───────────────── cabecera y menú ───────────────── */
  var cabecera = $('#cabecera');
  var boton = $('#hamburguesa');

  (function cabeceraFija() {
    if (!cabecera) return;
    var heroSec = $('#inicio');
    function actualizar() {
      var fija = heroSec ? window.pageYOffset > 40 : true;
      cabecera.classList.toggle('cabecera--fija', fija);
    }
    window.addEventListener('scroll', actualizar, { passive: true });
    actualizar();
  })();

  function cerrarMenu() {
    if (!cabecera || !boton || !cabecera.classList.contains('menu-abierto')) return;
    cabecera.classList.remove('menu-abierto');
    boton.setAttribute('aria-expanded', 'false');
    $('.visualmente-oculto', boton).textContent = 'Abrir menú';
    if (lenis) lenis.start();
  }
  if (boton) {
    boton.addEventListener('click', function () {
      var abierto = cabecera.classList.toggle('menu-abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      $('.visualmente-oculto', boton).textContent = abierto ? 'Cerrar menú' : 'Abrir menú';
      if (lenis) { if (abierto) lenis.stop(); else lenis.start(); }
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenu(); });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', cerrarMenu); });

  /* ───────────────── mapa solo bajo clic ───────────────── */
  (function mapa() {
    var btn = $('#mapa-boton');
    var caja = $('#mapa-consentimiento');
    if (!btn || !caja) return;
    btn.addEventListener('click', function () {
      var marco = document.createElement('iframe');
      marco.src = btn.getAttribute('data-mapa');
      marco.loading = 'lazy';
      marco.title = btn.getAttribute('data-titulo');
      marco.referrerPolicy = 'no-referrer-when-downgrade';
      caja.parentNode.replaceChild(marco, caja);
    });
  })();

  /* ───────────────── aviso de cookies ───────────────── */
  var claveCookies = slug() + '-cookies';
  (function cookies() {
    var caja = $('#cookies');
    var ok = $('#cookies-aceptar');
    if (!caja || !ok) return;
    var guardado = null;
    try { guardado = localStorage.getItem(claveCookies); } catch (e) {}
    if (guardado !== 'ok') {
      caja.hidden = false;
      document.body.classList.add('cookies-visibles');
    }
    ok.addEventListener('click', function () {
      caja.hidden = true;                     /* el CSS pone display solo si NO hay [hidden] */
      document.body.classList.remove('cookies-visibles');
      try { localStorage.setItem(claveCookies, 'ok'); } catch (e) {}
    });
  })();

  $$('[data-anio]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  /* las medidas cambian cuando llegan las fuentes: recalcular anclajes */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { pila.montar(); refrescar(); });
  }
  var temporizador;
  window.addEventListener('resize', function () {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { ajustarTitulo(); hero.montar(); pila.montar(); refrescar(); }, 220);
  });
  document.addEventListener('densidad-cambiada', function () {
    setTimeout(function () { ajustarTitulo(); hero.montar(); pila.montar(); refrescar(); }, 60);
  });

  /* [MANDO DE MAQUETA] inicio — SOLO REVISIÓN. Lo borra scripts/quitar_mandos.py hasta la marca de fin. */
  (function mandoMaqueta() {
    var mando = $('#mando');
    if (!mando) return;
    /* solo con ?revision: el enlace que recibe el cliente sale limpio */
    if (!/[?&]revision\b/.test(window.location.search)) return;
    mando.hidden = false;                       /* sin JS no haría nada: lo enseña el JS */
    /* mismas claves que el script bloqueante del <head>: <slug de la demo>-densidad */
    var primera = $('[data-cambiar-marca]', mando);
    var prefijo = primera ? primera.getAttribute('data-cambiar-marca') : slug();
    var clave = function (k) { return prefijo + '-' + k; };
    function pulsar(sel, activo) { $$(sel, mando).forEach(function (b) { b.setAttribute('aria-pressed', b === activo ? 'true' : 'false'); }); }

    /* versión */
    var bDens = $$('[data-densidad]', mando);
    var actualD = esSobria() ? 'sobria' : 'marca';
    bDens.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.densidad === actualD ? 'true' : 'false');
      b.addEventListener('click', function () {
        html.classList.remove('densidad-marca', 'densidad-sobria');
        html.classList.add('densidad-' + b.dataset.densidad);
        pulsar('[data-densidad]', b);
        try { localStorage.setItem(clave('densidad'), b.dataset.densidad); } catch (e) {}
        document.dispatchEvent(new CustomEvent('densidad-cambiada', { detail: b.dataset.densidad }));
      });
    });

    /* paleta */
    var bPal = $$('[data-paleta]', mando);
    var actualP = html.getAttribute('data-paleta') || 'a';
    bPal.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.paleta === actualP ? 'true' : 'false');
      b.addEventListener('click', function () {
        html.setAttribute('data-paleta', b.dataset.paleta);
        pulsar('[data-paleta]', b);
        try { localStorage.setItem(clave('paleta'), b.dataset.paleta); } catch (e) {}
      });
    });

    /* marca: «así quedaría con tu logo». Solo cambia una hoja, los <use> y el nombre */
    var marcas = [];
    try { marcas = JSON.parse(($('#mando-marcas') || {}).textContent || '[]'); } catch (e) {}
    $$('[data-cambiar-marca]', mando).forEach(function (b) {
      b.addEventListener('click', function () {
        var m = marcas.filter(function (x) { return x.slug === b.getAttribute('data-cambiar-marca'); })[0];
        if (!m || m.slug === slug()) return;
        pulsar('[data-cambiar-marca]', b);
        var hoja = $('#hoja-marca');
        var fuentes = $('#fuentes');
        if (fuentes) fuentes.href = m.fuentes_url;
        var aplicar = function () {
          html.setAttribute('data-marca', m.slug);
          html.setAttribute('data-personalidad', m.personalidad);
          html.setAttribute('data-fondo', m.polaridad);
          html.setAttribute('data-logo-oscuro', m.logo_oscuro);
          html.setAttribute('data-duotono', m.duotono);
          $$('[data-uso]').forEach(function (u) { u.setAttribute('href', '#' + u.getAttribute('data-uso') + '-' + m.slug); });
          $$('[data-vb="logo"]').forEach(function (s) { s.setAttribute('viewBox', m.logo_vb); });
          $$('[data-vb="isotipo"]').forEach(function (s) { s.setAttribute('viewBox', m.isotipo_vb); });
          $$('[data-vb="ventana"]').forEach(function (s) { s.setAttribute('viewBox', m.ventana_vb); });
          var rec = $('#ventana-recorte');
          if (rec) rec.style.clipPath = 'url(#ventana-caja-' + m.slug + ')';
          $$('[data-nombre]').forEach(function (el) {
            var texto = m[el.getAttribute('data-nombre')];
            if (!texto) return;
            if (el.hasAttribute('data-revelar')) { reescribir(el, texto); el.style.setProperty('--n', m.h1_n); }
            else el.textContent = texto;
          });
          document.dispatchEvent(new CustomEvent('densidad-cambiada'));
        };
        var nueva = document.createElement('link');
        nueva.rel = 'stylesheet';
        nueva.href = m.hoja;
        nueva.onload = function () { if (hoja) hoja.remove(); nueva.id = 'hoja-marca'; aplicar(); };
        nueva.onerror = aplicar;
        (hoja || document.head.lastChild).after(nueva);
      });
    });
  })();
  /* [MANDO DE MAQUETA] fin */

})();
