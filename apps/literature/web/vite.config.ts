import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindConfig from "./tailwind.config";

export default defineConfig( {
	server: {
		port: 3000,
		host: "localhost",
		fs: { allow: [ "../../../" ] }
	},
	plugins: [ react(), viteTsConfigPaths( { root: "../../../" } ) ],
	define: {
		"import.meta.vitest": undefined
	},
	css: {
		postcss: {
			plugins: [
				tailwindcss( tailwindConfig ),
				autoprefixer()
			]
		}
	}
} );