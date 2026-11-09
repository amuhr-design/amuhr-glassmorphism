# amuhr Glassmorphism

A WordPress plugin that adds a frosted-glass effect to blocks in the block editor. Switch it on in the block's style settings, pick a preset or adjust the sliders, and see the result live in the editor.

By default the effect is available for the Group, Column and Cover blocks.

The editor interface is currently in German. All strings are translatable (text domain `amuhr-glassmorphism`).

## Features

- Five presets (frosted white, milk glass, crystal, smoked glass, deep night) plus free settings
- Controls for blur, saturation, opacity and shadow
- Light and dark colour scheme, optional tint colour
- Optional gradient border and hover lift, which can be switched off per block
- Live preview in the editor
- The stylesheet is only loaded on pages that use the effect
- Fallbacks for reduced motion, reduced transparency, forced colours, print and browsers without `backdrop-filter`
- No settings page, no database entries, no build step

## Requirements

- WordPress 6.2 or newer
- PHP 7.4 or newer

## Installation

1. Download `amuhr-glassmorphism.zip` from the [latest release](../../releases/latest).
   Use this file, not GitHub's "Source code" archive: WordPress needs the folder inside the ZIP to be named `amuhr-glassmorphism`.
2. In WordPress, go to **Plugins → Add New → Upload Plugin**, choose the ZIP and activate the plugin.

## Usage

1. Select a Group, Column or Cover block.
2. Open the **Styles** tab in the block sidebar and expand **Glassmorphism**.
3. Switch on the effect, then choose a preset or adjust the controls.

The effect needs something behind the block to blur, so it works best on top of an image or a gradient.

## Markup

The plugin adds classes and CSS custom properties to the block's wrapper:

```html
<div class="wp-block-group has-glass-effect glass-theme-light"
     style="--glass-blur:10px;--glass-opacity:0.2;--glass-saturate:120%;--glass-shadow:0 10px 20px rgba(0,0,0,0.15)">
```

Further classes: `glass-theme-dark`, `has-glass-gradient-border`, `has-glass-no-hover`. A tint is stored as `--glass-rgb`.

## Filters

Enable the effect for more blocks:

```php
add_filter( 'amuhr_glass_supported_blocks', function ( $blocks ) {
	return array_merge( $blocks, array( 'core/columns' ) );
} );
```

Load the stylesheet on every page, for example when glass classes are used directly in theme templates:

```php
add_filter( 'amuhr_glass_load_everywhere', '__return_true' );
```

## Uninstalling

Deactivate and delete the plugin. Blocks keep their classes and inline styles in the content, but the effect is no longer displayed because the stylesheet is gone.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).

This plugin is provided free of charge and without warranty, as described in the license.
