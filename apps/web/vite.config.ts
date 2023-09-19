import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";

export default defineConfig( {
	cacheDir: "../../node_modules/.vite/web",
	server: {
		port: 3000,
		host: "localhost"
	},
	preview: {
		port: 3000,
		host: "localhost"
	},
	css: {
		postcss: {
			plugins: [
				require( "postcss-preset-mantine" )( {} ),
				require( "postcss-simple-vars" )( {
					variables: {
						"mantine-breakpoint-xs": "36em",
						"mantine-breakpoint-sm": "48em",
						"mantine-breakpoint-md": "62em",
						"mantine-breakpoint-lg": "75em",
						"mantine-breakpoint-xl": "88em"
					}
				} )
			]
		}
	},
	plugins: [ react(), vanillaExtractPlugin(), nxViteTsPaths() ]
} );
