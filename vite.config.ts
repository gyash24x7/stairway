import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { ManifestOptions } from "vite-plugin-pwa";
import { VitePWA } from "vite-plugin-pwa";

// The config is bundled before the `@/` alias it declares exists, so this is
// the one place in the project that has to reach into `src` relatively.
// oxlint-disable-next-line no-restricted-imports
import { GAME_NAMES, GAMES } from "./src/shared/games";


/**
 * The installed app's manifest. `theme_color` is the navbar's light background,
 * which the title bar sits against, and `background_color` the default theme's
 * (apple, light) surface, which the splash screen is painted with. Once the app
 * is running, `applyThemeColor` keeps the `theme-color` meta in step with
 * whichever theme was chosen.
 *
 * `launch_handler` makes a notification or a shortcut reuse the open window
 * rather than stacking a second copy of the app, which would hold a second live
 * subscription to the same table.
 */
const manifest: Partial<ManifestOptions> = {
	name: "Stairway",
	short_name: "Stairway",
	description: "Card and board games to play with friends.",
	start_url: "/",
	scope: "/",
	display: "standalone",
	theme_color: "#F3F4F6",
	background_color: "#FFE0E0",
	launch_handler: { client_mode: "navigate-existing" },
	icons: [
		{ src: "/pwa/pwa-64x64.png", sizes: "64x64", type: "image/png" },
		{ src: "/pwa/pwa-192x192.png", sizes: "192x192", type: "image/png" },
		{ src: "/pwa/pwa-512x512.png", sizes: "512x512", type: "image/png" },
		{
			src: "/pwa/maskable-icon-512x512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "maskable"
		}
	],
	shortcuts: GAME_NAMES.map( name => ( {
		name: GAMES[ name ].title,
		description: GAMES[ name ].tagline,
		url: `/${ name }`,
		icons: [ { src: `/logos/${ name }.svg`, sizes: "any", type: "image/svg+xml" } ]
	} ) )
};

export default defineConfig( ( { mode } ) => ( {
	resolve: {
		alias: {
			"@": fileURLToPath( new URL( "./src", import.meta.url ) )
		}
	},
	plugins: [
		react( { compiler: true } ),
		tailwindcss(),
		VitePWA( {
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.ts",
			registerType: "prompt",
			injectRegister: false,
			manifest,
			injectManifest: {
				// Only the shell everybody loads. The arena's Pixi chunks are lazy so
				// that nobody who stays on the classic pages downloads them, and card
				// and tile art is fetched as each game needs it; precaching either
				// would make every install download all of it up front. Both are
				// cached by the worker the first time they are used instead.
				globPatterns: [
					"index.html",
					"assets/index-*.{js,css}",
					"assets/rolldown-runtime-*.js",
					"assets/workbox-window*.js",
					"pwa/*.png",
					"stairway.svg"
				]
			},
			devOptions: { enabled: true, type: "module", navigateFallback: "index.html" }
		} )
	],
	server: {
		proxy: {
			"/api": {
				target: `http://localhost:${ loadEnv( mode, process.cwd(), "" )[ "PORT" ] }`,
				changeOrigin: true,
				ws: true
			}
		}
	}
} ) );
