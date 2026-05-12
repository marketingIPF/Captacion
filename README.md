# Captación · RK Palanca Fontestad

WebApp para que los agentes rellenen la ficha de captación de inmuebles desde el móvil o tablet, y envíen los datos por correo electrónico al CRM de iaGestión.

## ✨ Funcionalidades

- 📝 Formulario completo siguiendo la ficha de captación de papel (propietarios, ubicación, datos económicos, distribución, calidades, edificio y firmas).
- 💾 **Guardado automático** en el navegador (localStorage). Los datos no se pierden aunque cierres la pestaña.
- 🖋️ **Firma en pantalla** con el dedo para propietario(s) y agente.
- 📱 **Instalable como app** (PWA) en la pantalla de inicio del móvil. Funciona sin conexión una vez cargada.
- ✉️ **Envío por correo** con dos bloques:
  1. Datos legibles para revisión humana.
  2. Datos formateados para la API `grabar_prospecto` de iaGestión (clave=valor + JSON).
- 🗑️ **Botón "Borrar todo"** con confirmación.
- 👥 Lista de **37 agentes** con sus `IdGestor` precargados.

## 📨 Formato del correo

- **Asunto**: `Prospecto · Ref. [REF] · [Población]`
- **Cuerpo**:
  - Cabecera + agente + identificación
  - Datos por secciones (propietarios, ubicación, económicos, distribución, calidades, edificio, observaciones, firmas)
  - Bloque API IAGestión con todos los campos clave=valor y un JSON listo para enviar.

## 🚀 Despliegue en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `captacion`).
2. Sube todos los archivos al repo (puedes arrastrarlos desde el explorador o usar git):
   ```
   index.html
   manifest.webmanifest
   sw.js
   styles.css
   assets/
   js/
   ```
3. En el repo: **Settings → Pages → Source: Deploy from a branch → `main` / root** → Save.
4. Espera 1-2 minutos. Tu app estará en `https://[tu-usuario].github.io/captacion/`.

## 📱 Cómo instalar en el móvil

- **iPhone (Safari)**: abre la URL → botón Compartir → "Añadir a pantalla de inicio".
- **Android (Chrome)**: abre la URL → menú ⋮ → "Instalar aplicación".

Una vez instalada, aparece como una app más, funciona sin barra de navegador y carga sin conexión.

## 🛠️ Mantenimiento

- **Añadir / quitar agentes**: edita `js/agents.js` (array `AGENTS`).
- **Añadir poblaciones de sugerencia**: edita `js/agents.js` (array `POBLACIONES`).
- **Añadir tipos de inmueble**: edita `js/agents.js` (array `TIPOS_INMUEBLE`).
- **Cambiar textos/estilo**: `index.html` y `styles.css`.

## 📋 Datos protegidos

Los datos del formulario se guardan **solamente en el navegador del agente** (localStorage). Nada sale del dispositivo hasta que el agente pulsa "Enviar por correo". El envío usa el cliente de correo del propio dispositivo (Gmail, Mail de iOS, Outlook…).
