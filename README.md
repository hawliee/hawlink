# pink index

A tiny personal image collection: white space, pink topic links, and a freeform collage. Built with plain HTML, CSS, JavaScript and Node.js 22+; no dependencies or build step.

```sh
npm start
```

The server listens on port 3000 (`PORT` and `HOST` are configurable). `npm run dev` restarts it when server files change. `npm test` runs the integration tests with temporary, isolated data.

## Using your collection

- Create, rename and delete topics with **+ new tab** and **edit this tab**.
- Upload images, drag files onto the collage, or paste copied image data. Supports JPG, PNG, GIF and WebP up to 12 MB each. Copy an actual image, rather than a web page URL.
- In **edit**, drag images to arrange them; use the bottom-right handle to resize while preserving proportions. Arrow keys move a focused image; Shift moves faster. Select an image for link, layer and removal controls. Double-click or press Enter to edit its destination and caption.
- In **browse**, linked images open their destination in a new tab.
- Change the page background with **page colour**.
- Changes save to the server. Other open browsers check for updates every 2.2 seconds. Simultaneous edits surface a conflict with an explicit choice rather than silently overwriting another browser.

## Persistence and hosting

`data/board.json` and `data/uploads/` hold the shared collection and uploaded images. Both survive server restarts. Back up this directory. Set `DATA_DIR` to an absolute path on persistent storage when deploying. Starter photographs are bundled locally; the app needs no third-party image service.

For access from different devices, run this server at a shared HTTPS address with a persistent disk. Browser-local storage is used only to remember the selected tab, never for the saved collection. Running independent copies on separate hosts does not sync them. Processes and data in an ephemeral deployment will not provide durable hosting.

**This prototype has one shared board and no login. Anyone who can reach the server can edit it.** Before public hosting, add authentication or protect the whole site with your hosting provider's access control. Browse/edit is a convenience mode, not authorization. The JSON store is designed for one Node process; multiple server instances need a shared database and transaction handling. Public hosting and authentication have not been configured.

## Starter image credits

The seven removable sample images are from [ianare/exif-samples](https://github.com/ianare/exif-samples), contributed by its authors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They have been auto-oriented, resized, recompressed and stripped of metadata. The modified samples retain that license; see [photo credits](public/photos/credits.html) for individual source paths. No additional rights to user uploads are implied.
