# Guía de Despliegue en Render (Render.com)

Esta guía detalla paso a paso cómo subir y desplegar el sistema **TalentoVE - Recursos Humanos y Nómina Venezuela** en **Render** de forma gratuita, segura y con CDN global.

---

## 🚀 Método Recomendado: Static Site (Gratuito y Optimizado)

Render ofrece alojamiento gratuito para sitios estáticos construidos con Vite/React con HTTPS automático, certificados SSL y red CDN global.

### Paso 1: Obtener el Código del Proyecto
Desde el menú superior de **Google AI Studio**:
1. Haz clic en el menú desplegable de opciones (o icono de configuración/descarga).
2. Selecciona **"Export to GitHub"** (Exportar a GitHub) para subir el código directamente a tu cuenta de GitHub, o **"Download ZIP"** y súbelo a un repositorio nuevo en [GitHub](https://github.com).

---

### Paso 2: Crear el Servicio en Render

1. Entra a tu cuenta en [dashboard.render.com](https://dashboard.render.com/).
2. Haz clic en el botón azul **"New +"** (arriba a la derecha).
3. Selecciona **"Static Site"**.
4. Conecta tu cuenta de GitHub y elige tu repositorio: **`https://github.com/Psinza/rrhh-simple`**.

---

### Paso 3: Configurar los Parámetros de Compilación

Completa el formulario con los siguientes datos exactos:

| Campo | Valor Requerido | Explicación |
| :--- | :--- | :--- |
| **Name** | `rrhh-simple` | Nombre del servicio (genera `https://rrhh-simple.onrender.com`) |
| **Branch** | `main` | Rama principal del repositorio |
| **Build Command** | `npm install && npm run build` | Instala dependencias y compila Vite a producción |
| **Publish Directory** | `dist` | Carpeta donde Vite genera los archivos listos |

---

### Paso 4: Configurar Regla de Redirección SPA (Evita errores 404 al recargar)

Para que el sistema de rutas y módulos de React funcione correctamente al recargar cualquier pantalla:
1. En la página de configuración de tu servicio en Render, desplázate a la sección **"Redirects / Rewrites"**.
2. Haz clic en **"Add Rule"**.
3. Configura:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
4. Guarda los cambios.

*(Nota: Si usas el archivo `render.yaml` incluido en el proyecto, esta regla ya está preconfigurada automáticamente).*

---

### Paso 5: Desplegar

1. Haz clic en **"Create Static Site"**.
2. Render comenzará la compilación automáticamente. En aproximadamente 1-2 minutos verás el mensaje:
   `==> Your site is live at https://rrhh-simple.onrender.com`
3. ¡Listo! Tu sistema estará publicado en producción en tu enlace:
   👉 **https://rrhh-simple.onrender.com**

---

## ⚡ Método Alternativo: Despliegue con Blueprint (`render.yaml`)

El proyecto ya incluye el archivo `render.yaml` en la raíz. Puedes usar la función **Blueprints** de Render:

1. En Render Dashboard, ve a **"New +"** > **"Blueprint"**.
2. Selecciona tu repositorio.
3. Render leerá automáticamente el archivo `render.yaml` y preconfigurará:
   - Nombre del servicio
   - Comando de compilación (`npm install && npm run build`)
   - Carpeta de publicación (`dist`)
   - Reglas de reescritura SPA (`/*` -> `/index.html`)
   - Encabezados de seguridad HTTP
4. Haz clic en **"Apply"** y se desplegará al instante.

---

## 🔍 Solución de Problemas Frecuentes

### ¿Error de versión de Node en Render?
Si Render utiliza una versión antigua de Node.js, ve a **Environment** en Render y añade una variable de entorno:
- **Key**: `NODE_VERSION`
- **Value**: `20.18.0` (o `22`)

### ¿La página da error 404 al refrescar?
Asegúrate de que la regla de **Rewrite** esté activa:
`Source: /*`  ->  `Destination: /index.html` con tipo **Rewrite**.
