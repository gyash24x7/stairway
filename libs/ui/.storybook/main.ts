import type { StoryObjbookConfig } from "@storybook/react-vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { mergeConfig } from "vite";
import tailwindConfig from "./tailwind.config";

const config: StoryObjbookConfig = {
	stories: [ "../src/**/*.stories.@(js|jsx|ts|tsx|mdx)" ],
	addons: [ "@storybook/addon-essentials" ],
	framework: {
		name: "@storybook/react-vite",
		options: {}
	},
	viteFinal( viteConfig ) {
		return mergeConfig( viteConfig, {
			css: {
				postcss: {
					plugins: [
						tailwindcss( tailwindConfig ),
						autoprefixer()
					]
				}
			}
		} );
	}
};

export default config;