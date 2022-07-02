export default {
	displayName: "literature-router",
	preset: "../../../jest.preset.js",
	globals: {
		"ts-jest": {
			tsconfig: "<rootDir>/tsconfig.spec.json",
		}
	},
	collectCoverage: true,
	testEnvironment: "node",
	transform: {
		"^.+\\.[tj]s$": "ts-jest"
	},
	moduleFileExtensions: [ "ts", "js", "html" ],
	coverageDirectory: "../../../coverage/libs/literature/router"
};
