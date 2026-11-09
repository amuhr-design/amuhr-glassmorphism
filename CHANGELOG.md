# Changelog

## 1.1.1

- Renamed from "Gutenberg Glassmorphism Pro" to "amuhr Glassmorphism". Folder, classes and saved block markup are unchanged.

## 1.1.0

- Optional tint colour and a per-block switch for the hover effect
- Front-end stylesheet is only loaded on pages that use the effect
- Editor styles are loaded through `enqueue_block_assets`, so they reach the iframed editor and no longer load on every admin page
- The shadow setting is kept for users without the `unfiltered_html` capability
- Editor script no longer creates global variables
- Choosing "custom" as preset keeps the current values
- Filters `amuhr_glass_supported_blocks` and `amuhr_glass_load_everywhere`

## 1.0

- Initial version
