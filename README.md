# CITYLIFE / LifeAfterLogic

An oblique photographic city that evolves locally. No pre-rendered footage or paid inference service.

## Visual direction
Dense, weathered Hong Kong architecture, visible roofs and facades, a fixed high camera, no sky in the main crop. Neighbourhoods spread, compete and disappear. The goal is believable city morphology, not a city-builder game or a liquid filter.

## Run the first visual experiment
Open index.html in a browser, or enable GitHub Pages (Settings > Pages > Deploy from a branch > main / root). The default photograph loads from Wikimedia Commons. If that network request fails, use the Photo picker to load a downloaded copy. Click/tap the city to seed a colony. New seed restarts, Pause stops. It pauses while the tab is hidden.

This first mode is a procedural local colony system that composes overlapping photographic fragments; it is **not** trained AI or a 3D city simulation. It is an initial visual baseline, not a claim of architectural realism. The photograph is preserved underneath for now. The patch boundaries and persistence need visual review.

## Neural experiment
Do not start this while the RTNVE overnight render is using your 3090.

1. Download the repo ZIP and extract it.
2. Double-click TRAIN_CITY.bat. It uses the existing RTNVE CUDA PyTorch venv if present. Alternatively run python train.py --steps 3000 from a CUDA-enabled PyTorch environment (requires pillow and numpy).
3. The trainer downloads the public-domain photo into assets/city.jpg; if blocked, download it manually to that path.
4. Every 250 steps, results/ contains the browser-ready city_weights.json, a checkpoint, and sample/fresh PNGs.
5. Open index.html, click Neural weights, and select results/city_weights.json. The browser computes learned local updates using WebGL2, three floating-point state textures and a two-layer neural network; no Python service runs during viewing.

The training target is 128x96. The loss compares local colour/structure patch distributions at several scales, includes random state damage and gently encourages change. This is a **texture experiment**, not a semantic building generator. It may collapse into unconvincing texture and requires GPU training and visual evaluation. The weights are not yet trained. Browser inference requires WebGL2 with EXT_color_buffer_float. Desktop/phone performance is not yet benchmarked. The JSON stores learned weights, not video frames. Resume with python train.py --resume results/checkpoint.pt --steps 6000 (optimizer/weights restored, pool reinitialized).

## Source
Sham shui po day01.JPG — J. Carmichael, 4 January 2007, released into the public domain by the author.
- https://commons.wikimedia.org/wiki/File:Sham_shui_po_day01.JPG
- https://upload.wikimedia.org/wikipedia/commons/f/f2/Sham_shui_po_day01.JPG

Cropped in the browser and training script. No image is bundled; the browser and training launcher retrieve the source. A user-provided photo can be substituted (use material you can reuse).

## Next visual milestone
Assess the real photo and first neural outputs, then implement structured neighbourhood growth with building-aligned patches / learned texture rendering and preserve coherent shadows, facade lines and perspective. Only call the result successful if it still looks like architecture after a long rollout. No paid GPU server or prerecorded loops are planned.
