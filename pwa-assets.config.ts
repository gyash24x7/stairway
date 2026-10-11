import { defineConfig } from "@vite-pwa/assets-generator/config";


/**
 * Generates the installed app's icons from the stairway mark, with
 * `bunx pwa-assets-generator`. The output is committed under `public/pwa/`, so
 * this only needs running again when the mark or its background changes.
 *
 * `source.svg` is the mark drawn black on the apple accent, the default theme's
 * colour, with the background painted into the SVG itself: a launcher icon has
 * no theme to follow, and a bare black glyph on a transparent square disappears
 * on a dark home screen. The maskable icon pads that further, because a launcher
 * may crop it to a circle.
 *
 * `badge-96x96.png`, the small monochrome glyph Android shows in the status bar
 * for a notification, is not made here: it has to be the bare mark, white on
 * transparent, and the generator always paints a background. It was cut from
 * `public/stairway.svg` once, by hand.
 */
export default defineConfig( {
	headLinkOptions: { preset: "2023" },
	preset: {
		transparent: {
			sizes: [ 64, 192, 512 ],
			padding: 0,
			favicons: []
		},
		maskable: {
			sizes: [ 512 ],
			padding: 0.2,
			resizeOptions: { background: "#FF6B6B" }
		},
		apple: {
			sizes: [ 180 ],
			padding: 0,
			resizeOptions: { background: "#FF6B6B" }
		}
	},
	images: [ "public/pwa/source.svg" ]
} );
