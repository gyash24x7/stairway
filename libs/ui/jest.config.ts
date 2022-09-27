export default {
    displayName: "ui",
    preset: "../../jest.preset.js",
    globals: {
        "ts-jest": {
            tsconfig: "<rootDir>/tsconfig.spec.json",
        }
    },
    collectCoverage: true,
    testEnvironment: "jsdom",
    transform: {
        "^.+\\.[tj]sx?$": "ts-jest"
    },
    moduleFileExtensions: [ "ts", "tsx", "js", "jsx" ],
    coverageDirectory: "../../coverage/libs/ui"
};
