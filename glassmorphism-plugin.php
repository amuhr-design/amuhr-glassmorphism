<?php
/**
 * Plugin Name:       amuhr Glassmorphism
 * Description:       High-End Glassmorphismus-Effekte für Gutenberg-Blöcke mit Presets, Tönung, Verlaufsrahmen und Live-Vorschau.
 * Version:           1.1.1
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            amuhr design
 * License:           GPL-2.0-or-later
 * Text Domain:       amuhr-glassmorphism
 * Update URI:        false
 *
 * "Update URI: false" verhindert, dass WordPress.org ein fremdes Plugin mit
 * demselben Verzeichnisnamen als "Update" für dieses Plugin anbietet.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AMUHR_GLASS_FILE', __FILE__ );
define( 'AMUHR_GLASS_STYLE_HANDLE', 'amuhr-glass' );
define( 'AMUHR_GLASS_SCRIPT_HANDLE', 'amuhr-glass-editor' );

/**
 * Blöcke, die den Glas-Effekt unterstützen.
 *
 * Erweiterbar per Filter, z. B.:
 * add_filter( 'amuhr_glass_supported_blocks', fn( $b ) => array_merge( $b, array( 'core/columns' ) ) );
 *
 * @return string[]
 */
function amuhr_glass_supported_blocks() {
	$blocks = apply_filters(
		'amuhr_glass_supported_blocks',
		array( 'core/group', 'core/column', 'core/cover' )
	);

	return array_values( array_unique( array_filter( array_map( 'strval', (array) $blocks ) ) ) );
}

/**
 * Versionsnummer für Assets: Änderungszeit der Datei (Cache-Busting).
 *
 * @param string $relative_path Pfad relativ zum Plugin-Verzeichnis.
 * @return string
 */
function amuhr_glass_asset_version( $relative_path ) {
	$file = plugin_dir_path( AMUHR_GLASS_FILE ) . $relative_path;

	return file_exists( $file ) ? (string) filemtime( $file ) : '1.1.1';
}

/**
 * Stylesheet registrieren (noch nicht laden).
 */
function amuhr_glass_register_assets() {
	wp_register_style(
		AMUHR_GLASS_STYLE_HANDLE,
		plugins_url( 'assets/glass.css', AMUHR_GLASS_FILE ),
		array(),
		amuhr_glass_asset_version( 'assets/glass.css' )
	);

	// Erlaubt WordPress, das kleine Stylesheet inline auszugeben (spart einen Request).
	wp_style_add_data(
		AMUHR_GLASS_STYLE_HANDLE,
		'path',
		plugin_dir_path( AMUHR_GLASS_FILE ) . 'assets/glass.css'
	);
}
add_action( 'init', 'amuhr_glass_register_assets' );

/**
 * Editor: Styles für die Vorschau laden.
 *
 * "enqueue_block_assets" erreicht auch die Editor-Leinwand im iframe –
 * anders als das frühere "admin_head", das zudem jede Admin-Seite belastet hat.
 */
function amuhr_glass_enqueue_editor_styles() {
	if ( is_admin() ) {
		wp_enqueue_style( AMUHR_GLASS_STYLE_HANDLE );
	}
}
add_action( 'enqueue_block_assets', 'amuhr_glass_enqueue_editor_styles' );

/**
 * Editor: Bedienelemente laden.
 */
function amuhr_glass_enqueue_editor_script() {
	wp_enqueue_script(
		AMUHR_GLASS_SCRIPT_HANDLE,
		plugins_url( 'assets/glass-editor.js', AMUHR_GLASS_FILE ),
		array( 'wp-block-editor', 'wp-components', 'wp-compose', 'wp-element', 'wp-hooks', 'wp-i18n' ),
		amuhr_glass_asset_version( 'assets/glass-editor.js' ),
		true
	);

	wp_add_inline_script(
		AMUHR_GLASS_SCRIPT_HANDLE,
		'window.amuhrGlass = ' . wp_json_encode( array( 'blocks' => amuhr_glass_supported_blocks() ) ) . ';',
		'before'
	);

	wp_set_script_translations( AMUHR_GLASS_SCRIPT_HANDLE, 'amuhr-glassmorphism' );
}
add_action( 'enqueue_block_editor_assets', 'amuhr_glass_enqueue_editor_script' );

/**
 * Frontend: Styles nur laden, wenn die Seite den Effekt wirklich nutzt.
 *
 * Einzelseiten werden vorab geprüft, damit das CSS im <head> landet.
 * Alles andere (Template-Parts, Widgets, Archive, synchronisierte Vorlagen)
 * fängt amuhr_glass_enqueue_on_render() ab.
 */
function amuhr_glass_enqueue_frontend_styles() {
	if ( ! empty( $GLOBALS['amuhr_glass_needed'] ) || apply_filters( 'amuhr_glass_load_everywhere', false ) ) {
		wp_enqueue_style( AMUHR_GLASS_STYLE_HANDLE );
		return;
	}

	if ( is_singular() ) {
		$post = get_post();
		if ( $post instanceof WP_Post && false !== strpos( $post->post_content, 'has-glass-effect' ) ) {
			wp_enqueue_style( AMUHR_GLASS_STYLE_HANDLE );
		}
	}
}
// Späte Priorität: Das CSS steht – wie der frühere Inline-Block – hinter den
// Theme-Styles, damit sich an der Kaskade bestehender Seiten nichts ändert.
add_action( 'wp_enqueue_scripts', 'amuhr_glass_enqueue_frontend_styles', 100 );

/**
 * Frontend-Fallback: Styles nachladen, sobald ein Glas-Block gerendert wird.
 *
 * @param string $block_content Gerendertes HTML des Blocks.
 * @param array  $block         Geparster Block.
 * @return string Unverändertes HTML.
 */
function amuhr_glass_enqueue_on_render( $block_content, $block ) {
	if ( ! empty( $block['attrs']['glassEnabled'] ) ) {
		if ( did_action( 'wp_enqueue_scripts' ) ) {
			wp_enqueue_style( AMUHR_GLASS_STYLE_HANDLE );
		} else {
			// Block-Themes rendern vor wp_head: nur vormerken, damit das CSS
			// nicht vor den Theme-Styles in der Warteschlange landet.
			$GLOBALS['amuhr_glass_needed'] = true;
		}
	}

	return $block_content;
}
add_filter( 'render_block', 'amuhr_glass_enqueue_on_render', 10, 2 );

/**
 * KSES: Die Schatten-Variable für Benutzer ohne "unfiltered_html" erlauben.
 *
 * WordPress entfernt beim Speichern Inline-Style-Deklarationen mit Klammern
 * (hier: rgba()). Für Autoren, Mitarbeiter und in Multisite-Netzwerken ging
 * dadurch "--glass-shadow" verloren. Erlaubt wird ausschließlich exakt das
 * Format, das dieses Plugin selbst erzeugt – nichts Allgemeineres.
 *
 * @param bool   $allow_css       Bisherige Entscheidung von WordPress.
 * @param string $css_test_string Die geprüfte CSS-Deklaration.
 * @return bool
 */
function amuhr_glass_kses_allow_shadow( $allow_css, $css_test_string ) {
	if ( $allow_css ) {
		return $allow_css;
	}

	return 1 === preg_match(
		'/^\s*--glass-shadow\s*:\s*0 \d{1,3}(?:\.\d{1,2})?px \d{1,3}(?:\.\d{1,2})?px rgba\(0,\s?0,\s?0,\s?0?\.\d{1,2}\)\s*$/',
		(string) $css_test_string
	);
}
add_filter( 'safecss_filter_attr_allow_css', 'amuhr_glass_kses_allow_shadow', 10, 2 );
