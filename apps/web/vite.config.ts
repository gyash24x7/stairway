import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import mantinePostcssPreset from "postcss-preset-mantine";
import postcssSimpleVars from "postcss-simple-vars";
import { defineConfig } from "vite";

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
				mantinePostcssPreset( {} ),
				postcssSimpleVars( {
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
	plugins: [ react(), vanillaExtractPlugin() ]
} );
