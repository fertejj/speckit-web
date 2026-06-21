# SpecKit Manager

[Leer en Español](#speckit-manager-en-español)

SpecKit Manager is a modern Next.js desktop dashboard application designed to organize, view, and manage local software development repositories that use the **GitHub Spec-Kit architecture**. 

SpecKit is a specification-driven development pattern where features are designed, planned, tracked, and verified through structured markdown files inside a `specs/` folder.

---

## 🚀 Key Features

- **Local Repository Scanner:** Quickly scan your local drive directories (using absolute path input or a native folder browser dialog) to analyze project directories.
- **Spec-Kit Detection:** Automatically detects if a repository is using SpecKit by scanning for `.specify/` metadata or `specs/` directories.
- **Interactive Workspace Dashboard:** 
  - **Overview Board:** Displays a visual checklist of all features, their target git branches, release dates, available specifications files, and average development progress.
  - **Feature Workspace:** A workspace displaying the parsed HTML specifications (`spec.md`), implementation plans (`plan.md`), walkthroughs (`walkthrough.md`), and requirements checklists (`requirements.md`).
  - **Structured Tasks Dashboard:** Parses `tasks.md` to display an interactive checklists view separated by development phases (with status badges for Done, In Progress, and Todo).
- **Dynamic Markdown Translator:** Translate `.md` specifications on the fly into **English, Spanish, Portuguese, French, German, Italian, Japanese, or Chinese** with a single click.
  - *Zero-Config Translator:* Powered by a free translation API with server-side in-memory caching.
  - *Markup Protection:* Automatically isolates and protects code blocks, alert banners (e.g., `> [!NOTE]`), and task checklists (e.g., `- [ ]`, `- [/]`, `- [x]`) from being mangled or corrupted during translation.
- **Theme Support:** Modern, premium dark/light mode toggles.
- **Recent Projects History:** Remembers up to 8 of your recently scanned repositories for instant access.

---

## 📁 Spec-Kit Directory Structure

SpecKit Manager scans features within your local project. To get detected, a feature folder should follow this layout:

```text
your-project/
├── .specify/                  # Optional integration metadata
└── specs/                     # Folder containing features
    ├── 001-feature-one/       # Feature folder
    │   ├── spec.md            # Specifications & user requirements
    │   ├── plan.md            # Technical design & proposed changes
    │   ├── tasks.md           # Implementation checklist
    │   ├── walkthrough.md     # Verification & change logs
    │   └── checklists/
    │       └── requirements.md # Requirements checklist
    └── 002-feature-two/
        └── ...
```

---

## 💻 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation
Clone the repository, navigate into the directory, and install dependencies:
```bash
npm install
```

### Running Locally
Run the local Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the dashboard.

---

## 🛠️ Tech Stack
- **Framework:** Next.js (App Router, Server Actions)
- **Styling:** Vanilla CSS Modules (harmonious dark/light styling system)
- **Icons:** Lucide React
- **Markdown Parsing:** Marked (with customized GitHub-style alerts support)

---

# SpecKit Manager (En Español)

SpecKit Manager es una moderna aplicación de panel de control de escritorio desarrollada en Next.js, diseñada para organizar, visualizar y gestionar repositorios locales de desarrollo de software que utilizan la **arquitectura GitHub Spec-Kit**.

SpecKit es un patrón de desarrollo basado en especificaciones donde las funcionalidades se diseñan, planifican, rastrean y verifican a través de archivos Markdown estructurados dentro de una carpeta `specs/`.

---

## 🚀 Características Clave

- **Escáner de Repositorios Locales:** Escanea rápidamente carpetas de tu disco local (ingresando la ruta absoluta o usando un explorador de carpetas nativo) para analizar directorios de proyectos.
- **Detección de Spec-Kit:** Detecta de forma automática si un repositorio utiliza SpecKit buscando metadatos en `.specify/` o directorios `specs/`.
- **Panel de Control Interactivo:**
  - **Tabla Resumen:** Muestra una lista de control visual de todas las funcionalidades, sus ramas de git asignadas, fechas de lanzamiento, archivos disponibles y progreso promedio del desarrollo.
  - **Espacio de Trabajo de Funcionalidades:** Un panel interactivo que renderiza en HTML las especificaciones (`spec.md`), planes de implementación (`plan.md`), recorridos (`walkthrough.md`) y requisitos (`requirements.md`).
  - **Panel de Tareas Estructurado:** Analiza `tasks.md` para mostrar una lista de tareas interactiva desglosada en fases de desarrollo (con estados para Listo, En Progreso y Pendiente).
- **Traductor Dinámico de Markdown:** Traduce especificaciones `.md` en tiempo real al **inglés, español, portugués, francés, alemán, italiano, japonés o chino** con un solo clic.
  - *Traductor sin configuración:* Alimentado por una API de traducción gratuita y caché en memoria en el servidor.
  - *Protección de Sintaxis:* Aísla y protege automáticamente bloques de código, banners de alerta (ej. `> [!NOTE]`) y casillas de verificación (ej. `- [ ]`, `- [/]`, `- [x]`) para que no sufran alteraciones en la traducción.
- **Soporte de Temas:** Conmutación moderna y premium entre modos claro y oscuro.
- **Historial de Proyectos Recientes:** Recuerda hasta 8 de tus repositorios escaneados recientemente para un acceso instantáneo.

---

## 📁 Estructura del Directorio Spec-Kit

SpecKit Manager escanea las funcionalidades dentro de tu proyecto local. Para ser detectada, una funcionalidad debe seguir este diseño:

```text
mi-proyecto/
├── .specify/                  # Metadatos opcionales de integración
└── specs/                     # Carpeta que contiene las funcionalidades
    ├── 001-funcionalidad-uno/ # Carpeta de funcionalidad
    │   ├── spec.md            # Especificaciones y requisitos del usuario
    │   ├── plan.md            # Diseño técnico y cambios propuestos
    │   ├── tasks.md           # Checklist de implementación
    │   ├── walkthrough.md     # Verificación y registros de cambio
    │   └── checklists/
    │       └── requirements.md # Requisitos
    └── 002-funcionalidad-dos/
        └── ...
```

---

## 💻 Primeros Pasos

### Requisitos Previos
Asegúrate de tener instalado [Node.js](https://nodejs.org/) (se recomienda v18 o superior).

### Instalación
Clona el repositorio, navega a la carpeta e instala las dependencias:
```bash
npm install
```

### Ejecución Local
Inicia el servidor de desarrollo local de Next.js:
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para interactuar con la aplicación.
