# GraphWar Web

Browser build based directly on the original GraphWar source and original `rsc/` assets.

## GitHub Pages

Upload the contents of this folder to the repository root and enable GitHub Pages from the `main` branch and `/ (root)`.

`index.html` loads `graphwar-web.jar` through CheerpJ.

## Browser local game change

The original local-game path opened a TCP `ServerSocket` and connected to `localhost`.
The browser build keeps the original GraphServer protocol but uses an in-memory pair of
connections for local games, so no local TCP socket is required.
