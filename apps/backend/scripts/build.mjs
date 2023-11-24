import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import path from "node:path";
import process from "node:process";

await esbuild.build( {
	entryPoints: [ path.join( process.cwd(), "src/main.ts" ) ],
	bundle: true,
	format: "cjs",
	platform: "node",
	outfile: path.join( process.cwd(), "dist", "main.js" ),
	plugins: [
		nodeExternalsPlugin( {
			allowWorkspaces: true
		} )
	]
} );