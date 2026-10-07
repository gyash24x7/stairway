import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";


export default defineConfig( ( { mode } ) => ( {
	resolve: {
		alias: {
			"@": fileURLToPath( new URL( "./src", import.meta.url ) )
		}
	},
	plugins: [
		react( { compiler: true } ),
		tailwindcss()
	],
	server: {
		proxy: {
			"/api": {
				target: `http://localhost:${ loadEnv( mode, process.cwd(), "" )[ "PORT" ] }`,
				changeOrigin: true
			}
		}
	}
} ) );
