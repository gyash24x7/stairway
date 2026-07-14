import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig( {
	resolve: {
		alias: {
			"@": fileURLToPath( new URL( "./src", import.meta.url ) )
		}
	},
	plugins: [
		// Must be listed before the react plugin.
		tanstackRouter( { target: "react", autoCodeSplitting: true } ),
		react(),
		tailwindcss()
	]
} );
