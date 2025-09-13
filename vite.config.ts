import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import alchemy from "alchemy/cloudflare/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig( {
	plugins: [
		tsconfigPaths(),
		tanstackRouter( {
			target: "react",
			autoCodeSplitting: true,
			routesDirectory: "./src/app/routes",
			generatedRouteTree: "./src/app/route-tree.ts"
		} ),
		react(),
		tailwindcss(),
		alchemy()
	]
} );
