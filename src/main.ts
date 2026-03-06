import './style.css'
import { BODY_CATALOG } from './data/catalog'
import { SolarSystemApp } from './solar-system-app'

const appRoot = document.querySelector<HTMLDivElement>('#app')

if (!appRoot) {
  throw new Error('App mount element not found.')
}

const options = BODY_CATALOG.map((body) => `<option value="${body.name}"></option>`).join('')

appRoot.innerHTML = `
  <div class="shell">
    <div class="scene-shell">
      <div id="scene-root" class="scene-root"></div>
      <aside class="hud">
        <section class="panel panel-top">
          <div class="panel-row panel-title">
            <div>
              <p class="eyebrow">Approximate Solar System Explorer</p>
              <h1>Sun, planets, and all current planetary moons</h1>
            </div>
            <span class="snapshot">Catalog snapshot <span id="snapshot-meta"></span></span>
          </div>
          <div class="panel-grid">
            <label class="field">
              <span>Local date & time</span>
              <input id="date-input" type="datetime-local" min="1950-01-01T00:00" max="2050-12-31T23:59" />
            </label>
            <div class="field">
              <span>Live instant</span>
              <strong id="live-date-label"></strong>
              <small id="timezone-label"></small>
            </div>
            <div class="field field-inline">
              <span>Playback</span>
              <div class="inline-actions">
                <button id="play-button" type="button">Play</button>
                <button id="now-button" type="button">Now</button>
              </div>
            </div>
            <label class="field">
              <span>Simulation speed (days/sec)</span>
              <div class="speed-controls">
                <input id="speed-slider" type="range" min="-2" max="4" step="0.01" />
                <input id="speed-input" type="number" min="0.01" max="10000" step="0.01" />
              </div>
            </label>
          </div>
        </section>

        <section class="panel panel-bottom">
          <div class="panel-grid bottom-grid">
            <label class="field field-search">
              <span>Focus body</span>
              <div class="search-controls">
                <input id="focus-input" type="text" list="body-options" placeholder="Earth, Titan, Triton..." />
                <button id="focus-button" type="button">Focus</button>
              </div>
              <datalist id="body-options">${options}</datalist>
            </label>
            <div class="field">
              <span>Camera</span>
              <button id="camera-mode-button" type="button">Switch To Fly</button>
              <small>Orbit mode tracks the selected body. Fly mode uses drag + WASD/Q/E.</small>
            </div>
            <div class="field field-toggle">
              <label><input id="labels-checkbox" type="checkbox" checked /> Show labels</label>
              <label><input id="orbits-checkbox" type="checkbox" checked /> Show orbits</label>
            </div>
            <div class="field">
              <span>Selection</span>
              <h2 id="selected-title">Sun</h2>
              <p id="selected-meta"></p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
`

const solarSystemApp = new SolarSystemApp({
  mount: document.querySelector<HTMLDivElement>('#scene-root')!,
  dateInput: document.querySelector<HTMLInputElement>('#date-input')!,
  liveDateLabel: document.querySelector<HTMLSpanElement>('#live-date-label')!,
  timezoneLabel: document.querySelector<HTMLSpanElement>('#timezone-label')!,
  playButton: document.querySelector<HTMLButtonElement>('#play-button')!,
  speedSlider: document.querySelector<HTMLInputElement>('#speed-slider')!,
  speedInput: document.querySelector<HTMLInputElement>('#speed-input')!,
  focusInput: document.querySelector<HTMLInputElement>('#focus-input')!,
  focusButton: document.querySelector<HTMLButtonElement>('#focus-button')!,
  cameraModeButton: document.querySelector<HTMLButtonElement>('#camera-mode-button')!,
  labelsCheckbox: document.querySelector<HTMLInputElement>('#labels-checkbox')!,
  orbitsCheckbox: document.querySelector<HTMLInputElement>('#orbits-checkbox')!,
  nowButton: document.querySelector<HTMLButtonElement>('#now-button')!,
  selectedTitle: document.querySelector<HTMLHeadingElement>('#selected-title')!,
  selectedMeta: document.querySelector<HTMLParagraphElement>('#selected-meta')!,
  snapshotMeta: document.querySelector<HTMLSpanElement>('#snapshot-meta')!,
})

window.addEventListener('beforeunload', () => solarSystemApp.dispose())
