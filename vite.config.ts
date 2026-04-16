import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig( {
	resolve: {
		tsconfigPaths: true
	},
	build: {
		rolldownOptions: {
			external: [ "cloudflare:workers" ]
		}
	},
	plugins: [
		tailwindcss(),
		cloudflare( { viteEnvironment: { name: "ssr" } } ),
		tanstackStart(),
		react()
	]
} );
