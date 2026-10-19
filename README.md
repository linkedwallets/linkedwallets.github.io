# linkedwallets.github.io

Personal site of **linkedwallets** — an explorer for one person. Live at
<https://linkedwallets.github.io>.

Plain static files, no build step, no trackers, no cookies. Served from `main`
via GitHub Pages. The slot numbers tick with a little script and a fake
400-millisecond chain; everything else is honest HTML.

## Layout

- `/` — home: a map of the network with the transfer graph on it, a zoom into the node, the
  node taken apart by scroll, then the parts in full
- `/writings/` — essays, filed as transfers
- `/projects/` — small tools, filed as programs
- `/404.html` — a failed-transaction screen
- `assets/map/` — the map: a land mask, and the script that draws the dots and the graph
- `assets/node/` — the node: one module per group of parts, a shared kit, and the scroll scene

## Colophon

The home page opens on a flat map of the network. The land is blue-violet
dots on the paper, in an equirectangular projection cut in the Pacific, so the
ocean sits under the name. Small ink points mark where many validators run. The
transfer graph sits on top: the site's node in orange, its nine peers, and the
transfers as arcs (hover a wallet to light its edges). The map is one 18 KB
PNG land mask, made once from [world-atlas](https://github.com/topojson/world-atlas)
land-50m (Natural Earth data, public domain; world-atlas is ISC, licence in
`assets/map/`), and a canvas draws the dots in every frame of the zoom. Scroll
moves the camera down into the site's node: the map grows around it, finer
dots fill in, the orange mark hands over to the closed node, and the map fades
into the paper. The map and the node share one camera move: the map scales by
the same factor as the camera's distance shrinks.

Then the page shows one object: the node, a small server in a brushed-aluminium
case, rendered live with [three.js](https://threejs.org) r170 from one pinned
jsDelivr URL. Every part is built in code (no models, no images): the case,
the mainboard, the CPU, the SSD, the network card and a key chip. Scroll opens
the side panels, then takes every part out, then the camera visits five parts
in turn. The part in focus stays a render, the rest of the machine turns into a
pale blue blueprint, and an orange tag opens a small table with that part's
share of the site: the case holds the readme, the storage holds the essays,
the CPU runs the programs, the network card links the peers, the key chip
holds the name. The sequence follows [ghost.ai](https://ghost.ai): a pinned
stage, a camera that zooms from part to part, a blueprint behind the part in
focus, one orange tag. Nothing catches the wheel. With reduced motion the
map shows still, then the node once, fully apart, with every table open under
it.

The look is warm grey paper with a fine grain, black hairline tables and one
orange. A switch in the header (next to Search) turns on a dark mode: warm
near-black paper with the same grain, light ink, a lighter blue-violet, the
same orange. Without a choice the site follows the system setting. A choice is
kept in `localStorage`, and a small script in each page's head sets the mode
before the first paint. In dark the node gets a little more light and a lighter
blueprint, so the aluminium still reads. The typed nodes of the transfer graph come from an earlier pass
modelled on [andrewtrousdale.com](https://andrewtrousdale.com) (via
[hoverstat.es](https://www.hoverstat.es)). Essay pages borrow the serif long
read of [kedzich.com](https://kedzich.com) (via httpster.net).

Switzer (sans) and Gambetta (serif) from Fontshare, loaded from Fontshare's CDN
as the ITF Free Font License requires for a public repo. Commit Mono (SIL OFL,
via Uncut) for keys, signatures and the markings on the parts, self-hosted in
`assets/fonts/` with its licence. Hand-rolled CSS, no framework, no build step.
