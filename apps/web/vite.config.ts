import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";

export default defineConfig( {
	server: {
		port: 3000
	},
	preview: {
		port: 3000
	},
	plugins: [
		react(),
		TanStackRouterVite( { target: "react", autoCodeSplitting: true } )
	],
	css: {
		postcss: {
			plugins: [
				tailwindcss(),
				autoprefixer()
			]
		}
	}
} );
