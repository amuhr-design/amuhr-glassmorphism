/**
 * amuhr Glassmorphism – Editor-Erweiterung.
 *
 * In einer IIFE gekapselt: Die frühere Version legte Konstanten wie "el"
 * global an und konnte so mit Skripten anderer Plugins kollidieren.
 *
 * WICHTIG: Die gespeicherte Ausgabe (Klassen + Inline-Style) ist für
 * bestehende Blöcke identisch zu Version 1.0 – sonst meldet der Editor
 * "Dieser Block enthält unerwarteten oder ungültigen Inhalt".
 * Neue Optionen schreiben nur dann etwas ins Markup, wenn sie vom
 * Standard abweichen.
 */
( function ( wp ) {
	'use strict';

	const { createHigherOrderComponent } = wp.compose;
	const { InspectorControls } = wp.blockEditor;
	const {
		PanelBody,
		RangeControl,
		ToggleControl,
		RadioControl,
		SelectControl,
		BaseControl,
		ColorPalette,
		Button,
	} = wp.components;
	const { addFilter } = wp.hooks;
	const { createElement: el, Fragment } = wp.element;
	const { __ } = wp.i18n;

	const TEXT_DOMAIN = 'amuhr-glassmorphism';

	const SUPPORTED_BLOCKS =
		window.amuhrGlass && Array.isArray( window.amuhrGlass.blocks )
			? window.amuhrGlass.blocks
			: [ 'core/group', 'core/column', 'core/cover' ];

	const isSupported = ( name ) => SUPPORTED_BLOCKS.includes( name );

	const THEMES = [ 'light', 'dark' ];

	const LIMITS = {
		blur: { min: 0, max: 40, fallback: 10 },
		saturate: { min: 50, max: 300, fallback: 120 },
		opacity: { min: 0.05, max: 0.9, fallback: 0.2 },
		shadow: { min: 0, max: 100, fallback: 20 },
	};

	const PRESETS = {
		custom: { label: __( 'Eigene Einstellung', TEXT_DOMAIN ) },
		frosty: { label: __( 'Eisig Weiß', TEXT_DOMAIN ), blur: 15, opacity: 0.1, shadow: 10, theme: 'light', gradient: true, saturate: 140 },
		milk: { label: __( 'Milchglas', TEXT_DOMAIN ), blur: 24, opacity: 0.35, shadow: 24, theme: 'light', gradient: false, saturate: 110 },
		crystal: { label: __( 'Kristall', TEXT_DOMAIN ), blur: 6, opacity: 0.05, shadow: 30, theme: 'light', gradient: true, saturate: 160 },
		smoke: { label: __( 'Rauchglas', TEXT_DOMAIN ), blur: 16, opacity: 0.3, shadow: 30, theme: 'dark', gradient: false, saturate: 120 },
		deepNight: { label: __( 'Deep Night', TEXT_DOMAIN ), blur: 20, opacity: 0.5, shadow: 40, theme: 'dark', gradient: true, saturate: 180 },
	};

	const TINTS = [
		{ name: __( 'Eisblau', TEXT_DOMAIN ), color: '#bfe3ff' },
		{ name: __( 'Mint', TEXT_DOMAIN ), color: '#c2f5e1' },
		{ name: __( 'Rosé', TEXT_DOMAIN ), color: '#ffd1dc' },
		{ name: __( 'Bernstein', TEXT_DOMAIN ), color: '#ffe0a3' },
		{ name: __( 'Violett', TEXT_DOMAIN ), color: '#d9c8ff' },
		{ name: __( 'Nachtblau', TEXT_DOMAIN ), color: '#0f1c3f' },
		{ name: __( 'Graphit', TEXT_DOMAIN ), color: '#1f2328' },
	];

	const DEFAULTS = {
		glassPreset: 'custom',
		glassBlur: LIMITS.blur.fallback,
		glassOpacity: LIMITS.opacity.fallback,
		glassTheme: 'light',
		glassShadow: LIMITS.shadow.fallback,
		glassBorderGradient: false,
		glassSaturate: LIMITS.saturate.fallback,
		glassTint: '',
		glassHover: true,
	};

	/* ---------- Hilfsfunktionen ---------- */

	/** Zahl auf den erlaubten Bereich begrenzen; Unsinn fällt auf den Standard zurück. */
	function clamp( value, limit ) {
		const n = Number( value );
		if ( value === null || value === '' || ! Number.isFinite( n ) ) {
			return limit.fallback;
		}
		return Math.min( limit.max, Math.max( limit.min, n ) );
	}

	/** "#abc" / "#aabbcc" -> "170, 187, 204". Alles andere ergibt "" (keine Tönung). */
	function hexToRgbTriplet( hex ) {
		if ( typeof hex !== 'string' ) {
			return '';
		}
		const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec( hex.trim() );
		if ( ! match ) {
			return '';
		}
		let h = match[ 1 ];
		if ( h.length === 3 ) {
			h = h.replace( /./g, '$&$&' );
		}
		const n = parseInt( h, 16 );
		return [ ( n >> 16 ) & 255, ( n >> 8 ) & 255, n & 255 ].join( ', ' );
	}

	/** Klassen für einen Glas-Block. Das Farbschema kommt nur aus einer festen Liste. */
	function getGlassClasses( attributes ) {
		const theme = THEMES.includes( attributes.glassTheme ) ? attributes.glassTheme : 'light';
		return [
			'has-glass-effect',
			'glass-theme-' + theme,
			attributes.glassBorderGradient ? 'has-glass-gradient-border' : '',
			attributes.glassHover === false ? 'has-glass-no-hover' : '',
		]
			.filter( Boolean )
			.join( ' ' );
	}

	/** CSS-Variablen für einen Glas-Block (Reihenfolge wie in Version 1.0). */
	function getGlassStyle( attributes ) {
		const shadow = clamp( attributes.glassShadow, LIMITS.shadow );
		const style = {
			'--glass-blur': clamp( attributes.glassBlur, LIMITS.blur ) + 'px',
			'--glass-opacity': clamp( attributes.glassOpacity, LIMITS.opacity ),
			'--glass-saturate': clamp( attributes.glassSaturate, LIMITS.saturate ) + '%',
			'--glass-shadow': '0 ' + shadow / 2 + 'px ' + shadow + 'px rgba(0,0,0,0.15)',
		};
		const tint = hexToRgbTriplet( attributes.glassTint );
		if ( tint ) {
			style[ '--glass-rgb' ] = tint;
		}
		return style;
	}

	/* ---------- 1. Attribute registrieren ---------- */

	addFilter( 'blocks.registerBlockType', 'amuhr-glass/attributes', ( settings ) => {
		if ( ! isSupported( settings.name ) ) {
			return settings;
		}
		return Object.assign( {}, settings, {
			attributes: Object.assign( {}, settings.attributes, {
				glassEnabled: { type: 'boolean', default: false },
				glassPreset: { type: 'string', default: DEFAULTS.glassPreset },
				glassBlur: { type: 'number', default: DEFAULTS.glassBlur },
				glassOpacity: { type: 'number', default: DEFAULTS.glassOpacity },
				glassTheme: { type: 'string', default: DEFAULTS.glassTheme },
				glassShadow: { type: 'number', default: DEFAULTS.glassShadow },
				glassBorderGradient: { type: 'boolean', default: DEFAULTS.glassBorderGradient },
				glassSaturate: { type: 'number', default: DEFAULTS.glassSaturate },
				glassTint: { type: 'string', default: DEFAULTS.glassTint },
				glassHover: { type: 'boolean', default: DEFAULTS.glassHover },
			} ),
		} );
	} );

	/* ---------- 2. Bedienelemente im Stil-Tab ---------- */

	// Vermeidet Deprecation-Hinweise neuerer WordPress-Versionen.
	const modern = { __nextHasNoMarginBottom: true, __next40pxDefaultSize: true };

	function GlassControls( { attributes, setAttributes } ) {
		// Manuelle Änderung eines Reglers -> Preset steht wieder auf "Eigene Einstellung".
		const setCustom = ( patch ) =>
			setAttributes( Object.assign( { glassPreset: 'custom' }, patch ) );

		const applyPreset = ( key ) => {
			const p = PRESETS[ key ];
			if ( ! p || key === 'custom' ) {
				// "Eigene Einstellung" behält die aktuellen Werte, statt sie zurückzusetzen.
				setAttributes( { glassPreset: 'custom' } );
				return;
			}
			setAttributes( {
				glassPreset: key,
				glassBlur: p.blur,
				glassOpacity: p.opacity,
				glassShadow: p.shadow,
				glassTheme: p.theme,
				glassBorderGradient: p.gradient,
				glassSaturate: p.saturate,
			} );
		};

		return el(
			Fragment,
			{},
			el( SelectControl, Object.assign( {}, modern, {
				label: __( 'Design-Preset', TEXT_DOMAIN ),
				value: PRESETS[ attributes.glassPreset ] ? attributes.glassPreset : 'custom',
				options: Object.keys( PRESETS ).map( ( key ) => ( {
					label: PRESETS[ key ].label,
					value: key,
				} ) ),
				onChange: applyPreset,
			} ) ),
			el( RangeControl, Object.assign( {}, modern, {
				label: __( 'Weichzeichner (px)', TEXT_DOMAIN ),
				value: attributes.glassBlur,
				onChange: ( val ) => setCustom( { glassBlur: val } ),
				min: LIMITS.blur.min,
				max: LIMITS.blur.max,
			} ) ),
			el( RangeControl, Object.assign( {}, modern, {
				label: __( 'Sättigung (%)', TEXT_DOMAIN ),
				help: __( 'Verstärkt die Farben des Hintergrunds hinter dem Glas.', TEXT_DOMAIN ),
				value: attributes.glassSaturate,
				onChange: ( val ) => setCustom( { glassSaturate: val } ),
				min: LIMITS.saturate.min,
				max: LIMITS.saturate.max,
				step: 10,
			} ) ),
			el( RangeControl, Object.assign( {}, modern, {
				label: __( 'Deckkraft', TEXT_DOMAIN ),
				value: attributes.glassOpacity,
				onChange: ( val ) => setCustom( { glassOpacity: val } ),
				min: LIMITS.opacity.min,
				max: LIMITS.opacity.max,
				step: 0.05,
			} ) ),
			el( RangeControl, Object.assign( {}, modern, {
				label: __( 'Schatten', TEXT_DOMAIN ),
				value: attributes.glassShadow,
				onChange: ( val ) => setCustom( { glassShadow: val } ),
				min: LIMITS.shadow.min,
				max: LIMITS.shadow.max,
			} ) ),
			el( RadioControl, {
				label: __( 'Farbschema', TEXT_DOMAIN ),
				help: __( 'Bestimmt Grundfarbe des Glases und Textfarbe.', TEXT_DOMAIN ),
				selected: THEMES.includes( attributes.glassTheme ) ? attributes.glassTheme : 'light',
				options: [
					{ label: __( 'Hell (dunkler Text)', TEXT_DOMAIN ), value: 'light' },
					{ label: __( 'Dunkel (heller Text)', TEXT_DOMAIN ), value: 'dark' },
				],
				onChange: ( val ) => setCustom( { glassTheme: val } ),
			} ),
			el(
				BaseControl,
				{
					__nextHasNoMarginBottom: true,
					id: 'amuhr-glass-tint',
					label: __( 'Tönung (optional)', TEXT_DOMAIN ),
					help: __( 'Färbt das Glas ein. Auf ausreichenden Kontrast zum Text achten.', TEXT_DOMAIN ),
				},
				el( ColorPalette, {
					colors: TINTS,
					value: attributes.glassTint || undefined,
					clearable: true,
					enableAlpha: false,
					onChange: ( val ) =>
						setAttributes( { glassTint: hexToRgbTriplet( val ) ? val : '' } ),
				} )
			),
			el( ToggleControl, {
				__nextHasNoMarginBottom: true,
				label: __( 'Verlaufsrahmen', TEXT_DOMAIN ),
				checked: !! attributes.glassBorderGradient,
				onChange: ( val ) => setCustom( { glassBorderGradient: val } ),
			} ),
			el( ToggleControl, {
				__nextHasNoMarginBottom: true,
				label: __( 'Hover-Effekt (leichtes Anheben)', TEXT_DOMAIN ),
				help: __( 'Für große Bereiche oder reine Textflächen besser ausschalten.', TEXT_DOMAIN ),
				checked: attributes.glassHover !== false,
				onChange: ( val ) => setAttributes( { glassHover: val } ),
			} ),
			el(
				Button,
				{
					variant: 'tertiary',
					size: 'small',
					onClick: () => setAttributes( Object.assign( {}, DEFAULTS ) ),
				},
				__( 'Auf Standard zurücksetzen', TEXT_DOMAIN )
			)
		);
	}

	const withGlassControls = createHigherOrderComponent( ( BlockEdit ) => {
		return ( props ) => {
			if ( ! isSupported( props.name ) ) {
				return el( BlockEdit, props );
			}

			const { attributes, setAttributes } = props;

			return el(
				Fragment,
				{},
				el( BlockEdit, props ),
				el(
					InspectorControls,
					{ group: 'styles' },
					el(
						PanelBody,
						{
							title: __( 'Glassmorphism', TEXT_DOMAIN ),
							initialOpen: !! attributes.glassEnabled,
						},
						el( ToggleControl, {
							__nextHasNoMarginBottom: true,
							label: __( 'Glas-Effekt aktivieren', TEXT_DOMAIN ),
							help: attributes.glassEnabled
								? undefined
								: __( 'Wirkt am besten über einem Bild oder Farbverlauf.', TEXT_DOMAIN ),
							checked: !! attributes.glassEnabled,
							onChange: ( val ) => setAttributes( { glassEnabled: val } ),
						} ),
						attributes.glassEnabled
							? el( GlassControls, { attributes, setAttributes } )
							: null
					)
				)
			);
		};
	}, 'withGlassControls' );

	addFilter( 'editor.BlockEdit', 'amuhr-glass/with-controls', withGlassControls );

	/* ---------- 3. Gespeichertes HTML erweitern ---------- */

	addFilter(
		'blocks.getSaveContent.extraProps',
		'amuhr-glass/save-props',
		( props, blockType, attributes ) => {
			if ( ! isSupported( blockType.name ) || ! attributes.glassEnabled ) {
				return props;
			}
			return Object.assign( {}, props, {
				className: [ props.className, getGlassClasses( attributes ) ]
					.filter( Boolean )
					.join( ' ' ),
				style: Object.assign( {}, props.style || {}, getGlassStyle( attributes ) ),
			} );
		}
	);

	/* ---------- 4. Live-Vorschau im Editor ---------- */

	const withGlassVisuals = createHigherOrderComponent( ( BlockListBlock ) => {
		return ( props ) => {
			if ( ! isSupported( props.name ) || ! props.attributes.glassEnabled ) {
				return el( BlockListBlock, props );
			}

			const wrapperProps = props.wrapperProps || {};

			return el(
				BlockListBlock,
				Object.assign( {}, props, {
					className: [ props.className, getGlassClasses( props.attributes ) ]
						.filter( Boolean )
						.join( ' ' ),
					wrapperProps: Object.assign( {}, wrapperProps, {
						style: Object.assign( {}, wrapperProps.style || {}, getGlassStyle( props.attributes ) ),
					} ),
				} )
			);
		};
	}, 'withGlassVisuals' );

	addFilter( 'editor.BlockListBlock', 'amuhr-glass/with-visuals', withGlassVisuals );
} )( window.wp );
