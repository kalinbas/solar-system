# Solar System Explorer

Full-screen Three.js solar system explorer built with Vite and TypeScript.

It renders the Sun, all 8 planets, and the current JPL planetary moon catalog using browser-side approximate orbit propagation. Users can set a local date/time, play the simulation forward at configurable speed, focus any body, and move through the scene in 3D.

Live site: [kalinbas.github.io/solar-system](https://kalinbas.github.io/solar-system/)

## Features

- Full-screen single-page Three.js experience
- Sun, planets, and 400+ moons from a generated catalog
- Local date/time selection from 1950 through 2050
- Play/pause simulation with adjustable speed in days per second
- Search and focus controls for any body
- Orbit camera plus free-fly movement
- Curated JPL texture maps where available
- Procedural texture fallbacks for bodies without curated maps
- Approximate planet and moon positions computed in the browser from orbital elements

## Realism Model

This app uses hybrid scaling.

- Orbital distances come from the shipped orbital parameters
- Rendered body sizes are exaggerated so planets and moons remain visible and selectable
- Positions are approximate, not observatory-grade

The scaling logic is in [src/lib/scales.ts](src/lib/scales.ts).

## Tech Stack

- Vite
- TypeScript
- Three.js
- Vitest

## Project Structure

- [src/main.ts](src/main.ts): app bootstrap and HUD shell
- [src/solar-system-app.ts](src/solar-system-app.ts): scene setup, rendering, controls, interaction
- [src/lib/orbits.ts](src/lib/orbits.ts): analytic orbit propagation
- [src/lib/time.ts](src/lib/time.ts): simulation time helpers
- [src/data/catalog.ts](src/data/catalog.ts): generated catalog and reference data loading
- [scripts/generate-solar-system-data.mjs](scripts/generate-solar-system-data.mjs): fetches and builds the body catalog plus reference states
- [scripts/download-curated-textures.mjs](scripts/download-curated-textures.mjs): downloads curated JPL texture JPGs

## Getting Started

```bash
npm install
npm run generate:data
npm run generate:textures
npm run dev
```

Open the local Vite URL shown in the terminal.

## GitHub Pages

The app is deployed with GitHub Pages at [https://kalinbas.github.io/solar-system/](https://kalinbas.github.io/solar-system/).

Deployments run automatically from `main` via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

## Available Scripts

```bash
npm run dev
npm run build
npm test
npm run generate:data
npm run generate:textures
```

## Controls

- Orbit mode: drag to orbit, scroll to zoom, click a body to focus it
- Free-fly mode: switch with the UI button, then drag to look around
- Free-fly movement: `W`, `A`, `S`, `D`, `Q`, `E`
- Free-fly boost: hold `Shift`
- Playback/date controls: use the top HUD panel

## Data Sources

- JPL approximate planetary position tables
- JPL planetary satellite mean elements
- JPL planetary satellite physical parameter tables
- JPL Solar System Simulator texture maps
- JPL Horizons API reference vectors for validation snapshots

## Notes

- Texture coverage is mixed: curated maps are used where they exist, otherwise textures are generated procedurally.
- The moon list depends on the generated catalog snapshot in the repo.
- The current build is static and browser-only. No backend is required.
