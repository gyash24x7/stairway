const rootMain = require( "../../../.storybook/main" );

module.exports = {
	...rootMain,
	core: { builder: "webpack5" },
	stories: [
		...rootMain.stories,
		"../src/**/*.stories.mdx",
		"../src/**/*.stories.@(js|jsx|ts|tsx)"
	]
};
