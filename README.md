# CITYLIFE / LifeAfterLogic

A continuously evolving oblique city. Local procedural simulation, no model training, no prerecorded video, no inference server.

## View
Open index.html, or enable GitHub Pages (Settings > Pages > Deploy from a branch > main / root). The default is the procedural architectural experiment (city.js). No build step.

- Individual building footprints on a connected road network.
- 900 lots on narrow screens / 1,296 on desktop; some empty lots.
- 48 textured facade and roof variations, fixed oblique camera, directional shadow approximation.
- Continuous building-height changes, demolition and redevelopment, neighboring density pressure and randomly generated district events.
- Visitor-specific seed. Tap to disturb a district; change time scale, pause or generate a new city.
- 30 FPS target cap, offscreen culling, hidden-tab pause, capped canvas resolution.

Photo material reference is Sham shui po day01.JPG by J. Carmichael, 4 January 2007, released into the public domain by its author:
https://commons.wikimedia.org/wiki/File:Sham_shui_po_day01.JPG
The renderer optionally blends photographic grain into generated facade textures; if the source fails to load, the procedural materials still work. The architecture is generated geometry, not a reconstruction of the photograph. This is an initial visual study, not claimed photorealism. Browser visual testing and device benchmarks are still needed.

## Earlier experiments
photo-study.html preserves the initial photographic fragment study and optional neural mode. train.py, neural.js and TRAIN_CITY.bat remain available, but **not required** and not used by the default artwork. No training should be run alongside the overnight RTNVE job.

## Development
city.js exports CitySimulation in Node for deterministic simulation tests. Simulation state is independent of Canvas rendering. Bounds, deterministic seeded behavior and ongoing evolution have been checked in a 60-second simulated run. Next: visual review, more realistic building-specific texture sources, improved occlusion and shadows, more varied building topology and richer growth interactions.