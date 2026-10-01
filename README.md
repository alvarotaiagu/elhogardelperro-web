# Centro Veterinario El Hogar del Perro · Badajoz

Web de propuesta para la clínica de la calle Reyes Huertas, 3 (06008 Badajoz).
Es un **reskin** de `plantilla-veterinaria-web` («La marca manda»), hecho
siguiendo [RESKIN.md](RESKIN.md). No se ha tocado HTML, CSS ni JS de la
plantilla, solo `negocio.json`, `marca/` y `media/`.

- **Local:** `node scripts/servir.mjs` → http://127.0.0.1:4191/ (con los mandos de la reunión: `/?revision`).
- **Estado (2026-10-01):** publicada en https://alvarotaiagu.github.io/elhogardelperro-web/ (repo `alvarotaiagu/elhogardelperro-web`), con los mandos de la reunión. `noindex` en todas las páginas. No está en el portfolio Rúa.
- **Verificación:** `node scripts/verificar.mjs --capturas` → 109/109.

---

## Marca

**Logo.** Vectorizado a partir del logo de su página de Facebook (664 × 549 px).
El JPG de 150 px que mandaron era demasiado pequeño. Original, vector y
comparación en [cliente/](cliente/). Script: `python cliente/vectorizar-logo.py`.

- **Colores medidos:** perro #265691, texto #376092 y marino #17375E en «Centro Veterinario», la H y la P.
- **Gato blanco macizo:** el perfil del gato se ha redibujado como trazo continuo y el gato se ha rellenado de blanco, para que se lea sobre fondos de color.
- **Logo horizontal** (dibujo a la izquierda, texto a la derecha) para la cabecera y el pie: [cliente/logo-horizontal.svg](cliente/logo-horizontal.svg). Usa los mismos trazos del logo, solo recolocados.
- **Isotipo:** el perro y el gato. Su silueta maciza hace de ventana del hero y de cortina.
- **Si tienen el archivo de su imprenta o de su diseñador**, mejor ese: lo de ahora es un redibujo hecho desde una imagen.

**Paleta** (`marca-desde-logo.py`, personalidad `cercana`): todo sale del azul
del logo. Como el logo solo tiene un color con matiz, el script deriva el
segundo acento (#A6C7F1). Todos los contrastes pasan AA
(`marca/_contraste.txt`).

**Letra:** pareja `redondeada` (Fredoka + Figtree). Figtree se parece a la letra
del logo.

**Logo sobre fondo oscuro** (pie, urgencias): `mono`. Pierde el relleno blanco
del gato, que queda solo perfilado, pero se lee.

## De dónde sale cada dato

Investigación del 2026-10-01. Los textos completos y las fotos originales están
en `_scratch/investigacion/` (no se sube al repo).

| Dato | Fuente |
|---|---|
| Dirección, teléfono 924 23 29 86, horario L-V 9:30–14:00 y 17:30–21:00, 4,5★ con 112 opiniones | Ficha de Google (captura que mandó Álvaro) |
| «Clínica Veterinaria y Peluquería Canina», cita previa | Bio de Instagram @hogarperro |
| Email cv.elhogardelperro@gmail.com | FB «Información» y listado de prácticas de la UNEX 2023-24 |
| Urgencias 678 616 026 | Cartel de horario de verano en FB (5-jun-2025): «URGENCIAS 24H: 678 616 026» |
| Vacunas, desparasitación, microchip y pasaporte | Posts de FB (2021, 2023) y campaña de identificación (ene-2025) |
| Cirugía: esterilización y tumores de mama | Campañas de 2023-25; IG 11-jun-2024 (Kira); FB 4-may-2023 |
| Hospitalización, fluidoterapia | FB 8-jul-2023 (Kiara, una semana hospitalizada); FB 21-ago-2023 (vía) |
| Test de leishmania, filaria, ehrlichia, anaplasma, virus felinos; analítica | FB 1-jun-2023, IG 8-mar-2024, FB 30-may-2023, cartel de 2025 |
| Higiene bucal: limpieza y extracciones | IG 19-jun-2024 |
| Tienda: pienso, correas, juguetes, antiparasitarios | Fotos de la recepción (FB may-2023), ofertas de Flexi y cestas de Navidad |
| Perros y gatos | Campañas «gatitos y perritos», esterilización de gatos, reseñas |
| «La residencia es otro centro» (pregunta frecuente) | Sus respuestas en Google: «Esto es centro veterinario, no la residencia» |
| Opiniones de Lucía, Isabel y Sandra | Copia de las opiniones de Google en clinicaveterinaria.es. La de Lucía coincide con la que se ve en la ficha de Google |
| Lema «Nos preocupamos por tu mascota» | Portada de su FB: «Nos preocupamos por su mascota» (pasado a tú, como sus posts) |
| Fotos | Su página de Facebook (2021-2023). Ninguna enseña caras de personas |

## Pendiente de confirmar con la clínica

1. **Titular legal y NIF** para el aviso legal, la privacidad y el pie. Ahora pone **[PENDIENTE]**. Hay una pista en las notas privadas.
2. **Urgencias.** Su cartel de 2025 dice «24H», pero la web solo pone «Fuera del horario de consulta», sin prometer 24 h. Si confirman que es 24 h todos los días, cambiar `urgencias.modo` a `24h`.
3. **Horario.** Los directorios no coinciden entre sí y en verano cambian a mañanas más tardes de martes y jueves (cartel de 2025). Se ha usado el de Google. Para el verano se pueden poner `cierres` o un aviso.
4. **WhatsApp:** no consta. La cita va por teléfono.
5. **Equipo.** Las reseñas nombran a Marta (veterinaria) y FB presentó a María (veterinaria, 2023). Sin apellidos, sin colegiado y sin saber si siguen, así que el módulo está **apagado**. Hace falta nombre completo, cargo, colegiado y foto si quieren.
6. **Año de apertura.** La página de FB es de 2012 y la marca aparece en 2009, pero no consta cuándo abrió la clínica. Con el año se enciende «Desde … en Badajoz».
7. **Formas de pago y aparcamiento:** no constan. Con ellos se encienden en la sección de visita.
8. **Permiso para las citas de opiniones** de Lucía, Isabel y Sandra (RESKIN §4) y **para usar sus fotos de Facebook.**
9. **Foto de la fachada:** no hay ninguna en sus redes. Si la mandan, puede ir en «La clínica».
10. **Peluquería:** qué servicios concretos hace (corte a tijera, deslanado…) y el nombre de quien la lleva. Ahora pone «Baño, corte, con cita previa».
11. **Oftalmología:** en 2023 vino una oftalmóloga externa. Si es algo habitual, se puede añadir como servicio.

## Para la reunión

Notas privadas (opiniones negativas, residencia, posible titular): `_scratch/NOTAS-REUNION.md`, fuera del repo.

## Archivos de este cliente

- `negocio.json`: todos los datos. `marca/`: logo, mono, isotipo y `marca.json`. `media/`: fotos de su FB a 1600 px y 800 px.
- `cliente/`: el logo original (JPG de 150 px y el de 664 px de FB), los vectores intermedios, el logo horizontal, el script de vectorización y la comparación con el original.
- Los mandos de maqueta (`?revision`) siguen puestos. Se quitan antes de entregar (RESKIN §8).
