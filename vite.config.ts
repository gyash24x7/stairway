import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig( {
	resolve: {
		alias: {
			"@": fileURLToPath( new URL( "./src", import.meta.url ) )
		}
	},
	plugins: [
		tanstackRouter( {
			target: "react",
			autoCodeSplitting: true
		} ),
		react(),
		tailwindcss(),
		// Last, so the injected precache manifest sees the final emitted bundle.
		VitePWA( {
			// `injectManifest`, not `generateSW`: the latter emits a
			// Workbox-authored worker with no seam for our own code, which makes a
			// `push` listener impossible. The trade is that `src/sw.ts` has to wire
			// up precaching and runtime caching by hand.
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.ts",

			// The user chooses when a new build takes over, via a toast. An open
			// game must never have a lazy chunk pulled out from under it.
			registerType: "prompt",

			// We call `registerSW` ourselves in `src/pwa/client/register.ts` so the
			// update callback can reach the existing sonner toaster.
			injectRegister: null,

			// A service worker under `alchemy dev` fights HMR. Disabled also means
			// `virtual:pwa-register` resolves to a no-op stub, so the registration
			// module needs no `import.meta.env.PROD` guard.
			devOptions: { enabled: false },

			injectManifest: {
				// Precache the shell and the art the *landing page* needs — the six
				// game logos are the tiles themselves, so opening offline without
				// them looks broken rather than offline. `stairway.svg` is the
				// navbar mask on every screen that has chrome.
				globPatterns: [
					"**/*.{js,css,html}",
					"favicon.ico",
					"pwa-*.png",
					"maskable-icon-*.png",
					"apple-touch-icon-*.png",
					"pwa-icon.svg",
					"stairway.svg",
					"logos/*.svg"
				],
				// Card faces and Splendor tokens are ~1.8 MB and only matter once
				// you are inside a game you could not have joined offline anyway;
				// `src/sw.ts` runtime-caches them instead. `s2h.png` is unreferenced.
				globIgnores: [ "s2h.png", "cards/**", "splendor/**" ]
			},

			// If this layer ever has to be backed out, deleting `sw.js` is NOT
			// enough — a registered worker is sticky and existing installs keep
			// serving it. Ship a build with `selfDestroying: true` first.
			manifest: {
				id: "/",
				name: "Stairway",
				short_name: "Stairway",
				description: "Play Callbreak, Fish, Kingdomino, Splendor, Wordle and "
					+ "Tic Tac Toe with friends.",
				lang: "en",
				dir: "ltr",
				start_url: "/",
				scope: "/",

				// One value covers the whole app, so `standalone` rather than
				// `fullscreen`: stripping the status bar from the phone controller
				// and the landing page would be hostile. The couch/TV screen asks
				// for fullscreen imperatively instead.
				display: "standalone",

				// Deliberately no `orientation`: the couch board is landscape and
				// the controller is portrait, so any app-wide lock breaks one.

				// Matches the icon plate, so launch → splash → first paint is one
				// continuous dark field.
				background_color: "#1F1F1F",
				theme_color: "#1F1F1F",
				categories: [ "games", "entertainment" ],

				// Focus an open window rather than opening a second one: two windows
				// on the same game would hold two sockets into one Durable Object
				// and both write the same query key.
				launch_handler: { client_mode: "navigate-existing" },

				icons: [
					{ src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
					{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
					{
						src: "/pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any"
					},
					{
						src: "/maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable"
					}
				],

				// No per-shortcut icons yet: the files in `public/logos` are
				// fill-less mask sources, so each would need plating first. Android
				// falls back to the app icon, and iOS ignores shortcuts entirely.
				shortcuts: [
					{ name: "Callbreak", short_name: "Callbreak", url: "/callbreak" },
					{ name: "Fish", short_name: "Fish", url: "/fish" },
					{ name: "Kingdomino", short_name: "Kingdomino", url: "/kingdomino" },
					{ name: "Splendor", short_name: "Splendor", url: "/splendor" },
					{ name: "Tic Tac Toe", short_name: "Tic Tac Toe", url: "/tictactoe" },
					{ name: "Wordle", short_name: "Wordle", url: "/wordle" }
				]
			}
		} )
	]
} );
