import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig( {
	plugins: [
		// Must be listed before the react plugin.
		tanstackRouter( { target: "react", autoCodeSplitting: true } ),
		react(),
		cloudflare(),
		tailwindcss()
	]
} );
