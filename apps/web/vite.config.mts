// import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig( {
	root: __dirname,
	cacheDir: "../../node_modules/.vite/apps/web",

	server: {
		port: 3000,
		host: "localhost"
	},

	preview: {
		port: 3000,
		host: "localhost"
	},

	plugins: [
		react(),
		vanillaExtractPlugin()
		// nxViteTsPaths()
	],

	build: {
		outDir: "../../apps/web/dist",
		reportCompressedSize: true,
		commonjsOptions: {
			transformMixedEsModules: true
		}
	},

	define: {
		"import.meta.vitest": undefined
	}

} );