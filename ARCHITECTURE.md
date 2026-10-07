# Architecture

## What I built and why

A **static, frontend-only web app**: React + TypeScript + Vite, with the map drawn on a Canvas 2D. The browser downloads the raw parquet files and does all the parsing, cleaning and aggregation itself. It's hosted on Vercel.

The deciding factor was the size of the data: **1,243 files, ~89k rows, ~10 MB**. That fits comfortably in a browser tab, and the data never changes once loaded. With everything in memory, every filter, heatmap and playback frame is computed locally in a few milliseconds, with no network round trips and no server to keep alive. A backend would only add value if the data were too big to ship to the client, or had to be live or private. None of those apply here.

## How data flows to the screen

```
player_data/February_XX/*.nakama-0       (or an uploaded .zip with the same layout)
   │  build: prepare-data.mjs copies files → public/data + manifest.json (no transformation)
   ▼
browser: fetch 24 files at a time  ─or─  fflate unzips the upload (Web Worker)
   │  hyparquet decodes each file → rows
   ▼
clean (src/data/load.ts)
   · event bytes → string        · ts → epoch seconds (see assumptions)
   · drop exact duplicate rows    · bot = numeric user_id
   · (x, z) → minimap UV          · split rows into movement path vs discrete events
   ▼
group files by match_id → Match { journeys, start/end, counts }; t = ts − match start
   ▼
React state: filters (map, dates, match, humans/bots, event types) → visible journeys
   ├─ MapCanvas: minimap → heatmap → paths (up to playback time) → live positions → markers
   ├─ Heatmap: bin into a 192² grid → Gaussian blur → colour ramp (recomputed as time moves)
   ├─ Timeline: requestAnimationFrame clock, 1–40×
   └─ URL hash: map/dates/match/layers, so any view can be shared as a link
```

## Mapping game coordinates to the minimap

The game world is 3D. **`y` is height**, so a top-down map only uses **`x` and `z`**. Each map has a `scale` and an `origin` (from the README) that describe which square of the world the minimap image covers.

1. **World → UV (0–1).** `u = (x − originX) / scale`, `v = (z − originZ) / scale`. For Ambrose Valley (scale 900, origin −370, −473): world (−301.45, −355.55) → u = 0.0762, v = 0.1305.
2. **Flip v.** World z grows "north" (up), but image rows grow downward, so the image row is `1 − v`.
3. **UV → screen.** The minimap is drawn as a square of 1024 "map units", placed on screen with a pan/zoom transform: `screenX = offsetX + u·1024·zoom`, `screenY = offsetY + (1 − v)·1024·zoom`. The example lands at map pixel (78, 890), matching the README.

**Why UV and not pixels:** the README says the minimaps are 1024², but they're actually **4320², 2160×2158 and 9000²**. Mapping into the 0–1 range makes the image size irrelevant, so I could resize all three to 2048² (24 MB → 1.6 MB) without touching the maths. GrandRift's 2 px non-square edge is stretched to square, an error of under 0.1%.

**How I checked it:** (a) all 89k points fall inside 0–1 on every map (0% out of bounds); (b) bot paths follow the roads and corridors on all three minimaps; (c) the hover readout runs the inverse (`x = u·scale + originX`), so a designer can read world coordinates straight off the map.

## Assumptions where the data was ambiguous

| What I ran into | What I did |
|---|---|
| `ts` is typed as milliseconds, so it reads as Jan 1970 and a match lasts 0.4 s | The raw integers (~1.77e9) are **Unix seconds** (Feb 10–14 2026). Read as seconds, matches last ~6–15 min and positions arrive every ~5 s, which makes sense. The app treats them as seconds |
| README says `ts` is time since match start | It's wall-clock time. Match time = `ts − earliest event of any player in that match` |
| Numeric (bot) IDs also produce `Position` (636 rows) and `Loot` (115 rows) events | Bot vs human comes **only from the ID format**, as the README says, not from event names |
| `BotKill`/`BotKilled` appear inside bot files too | Events are shown as recorded, from the file owner's point of view. Insight stats use human files only |
| 1,420 rows are exact duplicates (same ts, event, x, y, z) | Dropped. 85 more rows match on everything except elevation, so they're kept |
| One match spans two day folders | Filed under the earlier day |
| 779 of 796 matches have exactly **one** human file | Treated as how the data was captured, not as a fact about lobby size. The match list can filter to multi-player matches |
| A journey with no death event | Assumed extracted (or left). Used as "survived" in insights |
| Folder names have no year | Year taken from the timestamps; unparseable folder names fall back to the UTC date of the first event |
| No storm position in the data | The storm isn't drawn. Storm deaths and timing stand in for it |

## Trade-offs

| Decision | Options considered | Pros / cons | Chose |
|---|---|---|---|
| Backend | **None** / FastAPI + DuckDB / Node API | No backend: free, instant, nothing to keep alive, but can't scale past what the browser can hold. Backend: scales and can hide raw data, but adds hosting, cold starts and latency to every filter | **None**. 10 MB doesn't need a server. If data grows to GBs, I'd add a DuckDB API for heatmaps and match lists and keep the same frontend |
| Where to parse | **Raw parquet in browser** / preprocess to JSON at build | Raw: one source of truth, and the same code path handles uploaded zips. JSON: slightly faster first load, but a second format to keep in sync | **Raw parquet** with hyparquet, a small dependency-free reader. First load takes a few seconds |
| Rendering | **Canvas 2D** / SVG / Leaflet / deck.gl | SVG struggles past ~10k nodes. Leaflet gives pan/zoom for free but is built for geo tiles. deck.gl is GPU-fast but heavy and more complex. Canvas is fast enough for 90k points, with full control, but pan/zoom and hit-testing are hand-written | **Canvas**, with ~100 lines for pan/zoom/hover |
| Heatmaps | **Live in the browser** / precomputed grids / server | Live: follows any filter combination and the playback clock. Precomputed: instant but fixed to preset filters | **Live**: 192² grid + separable blur takes a few ms per frame |
| Framework | **React + Vite** / Next.js / Streamlit | Streamlit is fastest to build but feels like a notebook and can't do smooth playback. Next.js brings server features I don't need | **React + Vite** |
| Minimap images | **2048² JPEG** / original / tiled | Originals are 24 MB (slow, and huge in GPU memory). Tiles allow deep zoom but need a tiling pipeline | **2048²**: sharp up to ~4× zoom |
| Upload | **Unzip in browser** / upload to a server | In-browser: private (data never leaves the machine) and needs no storage. A server could share uploads with others, but needs storage and auth | **In-browser** (fflate, off the main thread). Minimaps in the zip are skipped; bundled ones are used |
| Shareable state | **URL hash** / localStorage / none | A hash makes any view a link you can paste into Slack | **URL hash**; localStorage only remembers whether the tour was seen |
