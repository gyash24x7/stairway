module.exports = {
	stories: [],
	addons: [
		"@storybook/addon-essentials",
		{
			name: "@storybook/addon-postcss",
			options: {
				postcssLoaderOptions: {
					implementation: require( "postcss" )
				}
			}
		}
	],
	babel: async ( options ) => ( {
		...options,
		presets: [
			"@babel/preset-env",
			"@babel/preset-react",
			"@babel/preset-typescript"
		]
	} )
};
