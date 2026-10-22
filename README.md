# Ahorritos Tribu Sin Guía

Alcancía del viaje de la Tribu Sin Guía. Cada viajero tiene su propia meta y, con cada abono, el caminante avanza por el sendero hasta la cima.

Sitio en vivo: https://ahorritos-tribu-sin-guia.vercel.app

## Cómo funciona

- Página estática (`index.html`, `style.css`, `app.js`, `hiker.png`), sin paso de compilación.
- Los datos viven en Supabase, en las tablas `ahorro_viajeros` y `ahorro_abonos`. La página habla con la API REST de Supabase usando la llave pública (publishable key), que es segura para el navegador.
- Cualquiera con el link puede registrar abonos. Quien hizo un abono puede deshacerlo solo desde el mismo navegador.
- Solo el administrador agrega o quita viajeros y borra abonos de otros. La clave se revisa en el servidor (funciones `ahorro_es_admin` y `ahorro_admin_*`) y se guarda cifrada con bcrypt en `ahorro_config`. La clave no está en este repositorio.

## Publicar

Vercel publica automáticamente cada cambio que llega a `main`.
