import { defineConfig } from "@vite-pwa/assets-generator/config";

/**
 * Rasterises `public/pwa-icon.svg` into the icon set the manifest and iOS need.
 *
 * Run deliberately via `bun run icons`; the output is committed. Wiring this
 * into the Vite build instead would drag `sharp` — a native module — into every
 * CI run, for artefacts that change perhaps twice a year.
 *
 * `padding: 0` throughout is correct only because the source SVG already keeps
 * the mark inside the maskable safe circle and carries its own plate. The stock
 * presets pad by 30% on a *white* field, which would ring the plate in white.
 */
export default defineConfig( {
	headLinkOptions: { preset: "2023" },
	preset: {
		transparent: {
			sizes: [ 64, 192, 512 ],
			favicons: [ [ 48, "favicon.ico" ] ],
			padding: 0
		},
		maskable: {
			sizes: [ 512 ],
			padding: 0
		},
		apple: {
			sizes: [ 180 ],
			padding: 0
		}
	},
	images: [ "public/pwa-icon.svg" ]
} );
