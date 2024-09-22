import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack";

export default defineConfig( {
	html: {
		title: "Stairway"
	},
	plugins: [ pluginReact() ],
	tools: {
		postcss: () => ( {
			postcssOptions: {
				plugins: [ require( "tailwindcss" ) ]
			}
		} ),
		rspack: {
			plugins: [ TanStackRouterRspack() ]
		}
	}
} );
