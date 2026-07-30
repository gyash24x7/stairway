import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

const client = [ "src/ui/**", "src/web/**", "src/auth/client/**", "src/games/*/client/**" ];
const server = [ "src/platform/**", "src/auth/server/**", "src/games/*/server/**", "src/*.ts" ];
const shared = [ "src/schema/**", "src/utils/**", "src/contract/**", "src/engine/**", "src/games/*/shared/**" ];

export default [
	{
		files: [ "src/**/*.ts", "src/**/*.tsx" ],
		languageOptions: {
			parser: tsParser,
			parserOptions: { ecmaFeatures: { jsx: true } }
		},
		plugins: { import: importPlugin },
		settings: {
			"import/resolver": {
				typescript: { project: "./tsconfig.json" }
			}
		},
		rules: {
			"import/no-restricted-paths": [ "error", {
				zones: [
					{
						target: client,
						from: server,
						message: "Client code must not import server-only code."
					},
					{
						target: server,
						from: client,
						message: "Server code must not import client-only code."
					},
					{
						target: shared,
						from: [ ...client, ...server ],
						message: "Shared code must not import client- or server-only code."
					}
				]
			} ]
		}
	}
];
