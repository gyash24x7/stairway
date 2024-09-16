const { NxAppWebpackPlugin } = require( "@nx/webpack/app-plugin" );
const { join } = require( "node:path" );

module.exports = {
	output: {
		path: join( __dirname, "dist" )
	},
	plugins: [
		new NxAppWebpackPlugin( {
			target: "node",
			compiler: "tsc",
			main: "./src/main.ts",
			tsConfig: "./tsconfig.json",
			assets: [],
			optimization: false,
			outputHashing: "none",
			generatePackageJson: true
		} )
	]
};
