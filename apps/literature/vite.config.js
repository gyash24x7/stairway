import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path";

export default defineConfig( {
	plugins: [ react() ],
	root: __dirname,
	server: {
		port: 3000,
		fs: { allow: [ "../../" ] }
	},
	build: {
		minify: "esbuild",
		emptyOutDir: true,
		outDir: path.join( __dirname, "..", "..", "dist", "apps", "prime" )
	},
	preview: {
		port: 3000
	}
} )