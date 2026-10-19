# linkedwallets.github.io

Personal site of **linkedwallets** — an explorer for one person. Live at
<https://linkedwallets.github.io>.

Plain static files, no build step, no trackers, no cookies. Served from `main`
via GitHub Pages. The block numbers tick with a little script and a fake
12.1-second chain; everything else is honest HTML.

## Layout

- `/` — home: the person as an exploded view, with the transfer graph as part 04
- `/writings/` — essays, filed as transfers
- `/projects/` — small tools, filed as contracts
- `/404.html` — a revert screen

## Colophon

The home page is an exploded view of one wallet, drawn as six layers of one
person: shell, transfers, contracts, graph, address, key. Scroll takes the stack
apart, then brings each layer into focus with its content. The scroll
behaviour follows [ghost.ai](https://ghost.ai): a pinned stage, a camera that
leans in on the focused part, the other parts dimmed to outlines, and one
orange label pill. The plates are CSS 3D, with no images and no library.
With reduced motion the stack shows fully exploded and does not move.

The look is a technical drawing on warm off-white grid paper: black hairlines,
hatched plate edges, one orange core, a title block. The pass before was
modelled on [andrewtrousdale.com](https://andrewtrousdale.com) (via
[hoverstat.es](https://www.hoverstat.es)): the typed nodes of the transfer
graph and the dotted-rule rows come from that pass. Essay pages borrow the
serif long read of [kedzich.com](https://kedzich.com) (via httpster.net).

Supreme (sans) and Gambetta (serif) from Fontshare, loaded from Fontshare's CDN
as the ITF Free Font License requires for a public repo. Commit Mono (SIL OFL,
via Uncut) for hashes, self-hosted in `assets/fonts/` with its licence.
Hand-rolled CSS, no framework.
