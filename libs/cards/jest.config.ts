export default {
	displayName: "cards",
	preset: "../../jest.preset.js",
	globals: {
		"ts-jest": {
			tsconfig: "<rootDir>/tsconfig.spec.json",
		}
	},
	testEnvironment: "node",
	collectCoverage: true,
	transform: {
		"^.+\\.[tj]s$": "ts-jest"
	},
	moduleFileExtensions: [ "ts", "js" ],
	coverageDirectory: "../../coverage/libs/cards"
};
