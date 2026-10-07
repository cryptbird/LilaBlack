# LILA BLACK · Player Journeys

A browser tool for Level Designers to see how players actually move through LILA BLACK maps: their paths, where fights happen, where people die (to bots, to other players, to the storm), where they loot, and which parts of the map nobody uses.

**Live:** [https://lilablack-mu.vercel.app/](https://lilablack-mu.vercel.app/)

## What it does


| Feature                          | How to use it                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Player paths on the real minimap | Humans = solid cyan lines, bots = dashed orange lines                                                    |
| Event markers                    | ✕ kill, ● death, ◆ loot. Red = vs human, orange = vs bot, purple = storm. Hover for details              |
| Filters                          | Map, any combination of dates, a single match, humans/bots, each event type                              |
| Match list                       | Search by ID, sort by players / combat / length, "2+ players only"                                       |
| Playback                         | Play / pause / scrub / 1×–40× speed. Works for one match or all matches at once (aligned to match start) |
| Heatmaps                         | Traffic, kills, deaths, storm deaths, loot. They follow the filters *and* the timeline                   |
| Shareable views                  | The URL updates as you click, so you can send someone the exact match and filters you're looking at      |
| Upload your own data             | "Upload data (.zip)" button or drag-and-drop a zip laid out like the original `player_data.zip`          |
| First-run tour                   | Short walkthrough of every control, with Skip/Next. Replay it from the **?** button                      |


Keyboard: `space` play/pause · `esc` exit fullscreen, then back to all matches · scroll to zoom · drag to pan · double-click (or ⟲) to reset the view · the corner-arrows button toggles a fullscreen map + timeline.

## Tech stack

- **React 18 + TypeScript + Vite**: UI and build
- **Canvas 2D**: map, paths, markers and heatmap rendering (handles ~90k points smoothly)
- **[hyparquet](https://github.com/hyparam/hyparquet)**: reads the raw parquet files directly in the browser
- **[fflate](https://github.com/101arrowz/fflate)**: unzips uploaded data in the browser (in a Web Worker)
- **Vercel**: static hosting, no server

There is no backend and no database. See [ARCHITECTURE.md](ARCHITECTURE.md) for why.

## Setup

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run dev` and `npm run build` both run `scripts/prepare-data.mjs` first. It copies the raw files from `player_data/` into `public/data/` (git-ignored) and writes a `manifest.json` listing them. The data itself is not changed; all parsing and cleaning happens in the browser.

```bash
npm run build      # static site in dist/
npm run preview    # serve the built site locally
```



### Environment variables

None. The app is fully static and makes no API calls.

Minimaps: the originals in `player_data/minimaps/` are 2160–9000 px and 24 MB in total, so web-sized 2048 px copies are committed in `public/minimaps/`. The prepare script only regenerates them if they are missing.

## Project layout

```
player_data/              raw data exactly as received (parquet files, minimaps, README)
scripts/prepare-data.mjs  copies data into public/, writes manifest, resizes minimaps
public/minimaps/          2048px minimaps used by the app
src/
  config.ts               map scale/origin, event styles, heatmap layers
  data/load.ts            fetch/unzip → parquet decode → clean → matches
  data/model.ts           types
  lib/heatmap.ts          grid binning, Gaussian blur, colour ramp
  lib/urlState.ts         shareable view state in the URL hash
  components/MapCanvas    map rendering, pan/zoom, hover/click
  components/Timeline     playback controls
  components/Sidebar      filters + match list
  components/DetailsPanel stats + per-player list
  components/Tour         first-run walkthrough
```



## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md): decisions, data flow, coordinate mapping, assumptions, trade-offs
- [INSIGHTS.md](INSIGHTS.md): three things the tool shows about the game

