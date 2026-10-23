# hawlink
personal pinterest

**pink index** is a minimalist collage website: white background, pink topic links, and images you can paste, upload, move, resize and attach hyperlinks to.

The entire website is **[index.html](index.html)**, including styling, controls and starter photographs. No separate JavaScript, CSS, server, packages or build step is needed. Download it and open it in your browser for a local preview.

For a website address and saving across devices, follow **[the setup guide](SETUP.md)**. GitHub Pages hosts the HTML; Supabase supplies private sign-in, layouts and image storage. **The Supabase connection is not configured yet.** The site labels the local preview until it is connected.

- Pink topic tabs, with rename/delete controls.
- Paste image data, upload, or drop JPG, PNG, GIF or WebP files up to 12 MB.
- Drag to move; pull a selected image's corner to resize; arrow keys also move it.
- Double-click to set a link/caption. Browse mode follows links.
- Page colour, layer order, deletion, and backup download/restore.
- Private cloud collections, session refresh, device polling, and explicit conflict choices once connected.

The SQL file is a one-time setup instruction for the storage service, not another website component. Only the Project URL and public publishable/anon key go into the HTML. Passwords and secret/service-role keys never belong there.

## Starter photo credits

Photos by contributors to [ianare/exif-samples](https://github.com/ianare/exif-samples), under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They were oriented, resized, recompressed, stripped of metadata and embedded in HTML; modified copies retain that license. Source paths appear in the website's © dialog. User uploads retain their own rights.

The Node prototype has been replaced by this single HTML file. Any existing ignored `data/` directory is preserved locally; it isn't uploaded to GitHub or automatically moved to Supabase.
