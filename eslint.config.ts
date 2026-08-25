import effectPlugin from "@effect/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";

const client = [
	"src/routes/**",
	"src/main.*",
	"src/routeTree.*",
	"src/shared/ui/**",
	"src/*/client/**",
	"src/games/*/client/**"
];

const server = [
	"src/platform/**",
	"src/*/server/**",
	"src/games/*/server/**",
	"src/worker.*"
];

const shared = [
	"src/api.*",
	"src/client.*",
	"src/*/shared/**",
	"src/games/*/shared/**",
	"src/shared/cards/**",
	"src/shared/swish/**",
	"src/shared/utils/**"
];

export default [
	{
		ignores: [ "src/routeTree.gen.ts" ]
	},
	{
		files: [ "src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx" ],
		languageOptions: {
			parser: tsParser,
			parserOptions: { ecmaFeatures: { jsx: true } }
		},
		plugins: {
			"import-x": importPlugin,
			"@typescript-eslint": tsPlugin,
			"@stylistic": stylistic,
			effect: effectPlugin,
			perfectionist
		},
		settings: {
			"import-x/resolver": {
				typescript: {
					project: [ "./tsconfig.json" ],
					noWarnOnMultipleProjects: true
				}
			},
			"import-x/internal-regex": "^@/"
		},
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector: "FunctionDeclaration[returnType][returnType.typeAnnotation.type!='TSTypePredicate']",
					message: "Explicit return type annotations are not allowed"
				},
				{
					selector: "FunctionExpression[returnType][returnType.typeAnnotation.type!='TSTypePredicate']",
					message: "Explicit return type annotations are not allowed"
				},
				{
					selector: "ArrowFunctionExpression[returnType][returnType.typeAnnotation.type!='TSTypePredicate']",
					message: "Explicit return type annotations are not allowed"
				}
			],
			"import-x/extensions": [ "error", "ignorePackages", { checkTypeImports: true } ],
			"no-restricted-imports": [
				"error", {
					patterns: [
						{
							regex: "^\\.\\.?/",
							message: "Relative imports are not allowed. Use the \"@/\" path alias instead."
						}
					]
				}
			],
			"@typescript-eslint/consistent-type-imports": [
				"error", {
					prefer: "type-imports",
					fixStyle: "separate-type-imports"
				}
			],
			"@stylistic/space-in-parens": [ "error", "always" ],
			"@stylistic/object-curly-spacing": [ "error", "always" ],
			"@stylistic/array-bracket-spacing": [ "error", "always" ],
			"@stylistic/template-curly-spacing": [ "error", "always" ],
			"@stylistic/quotes": [ "error", "double" ],
			"@stylistic/semi": [ "error", "always" ],
			"@stylistic/comma-dangle": [ "error", "never" ],
			"@stylistic/eol-last": [ "error", "always" ],
			"@stylistic/no-multiple-empty-lines": [ "error", { max: 2 } ],
			"@stylistic/quote-props": [ "error", "as-needed" ],
			"@stylistic/member-delimiter-style": "error",
			"@stylistic/type-annotation-spacing": "error",
			"@stylistic/keyword-spacing": "error",
			"@stylistic/space-before-blocks": "error",
			"@stylistic/space-infix-ops": "error",
			"@stylistic/key-spacing": "error",
			"@stylistic/comma-spacing": "error",
			"@stylistic/arrow-spacing": "error",
			"@stylistic/no-multi-spaces": "error",
			"effect/no-import-from-barrel-package": [
				"error", { packageNames: [ "effect", "@effect/platform" ] }
			],
			"@stylistic/no-trailing-spaces": [ "error", { skipBlankLines: false } ],
			"import-x/consistent-type-specifier-style": [ "error", "prefer-top-level" ],
			"sort-imports": [
				"error", {
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					ignoreCase: true
				}
			],
			"perfectionist/sort-imports": [
				"error", {
					groups: [
						[ "value-builtin", "value-external" ],
						[ "type-builtin", "type-external" ],
						"value-internal",
						"type-internal",
						"unknown"
					],
					newlinesBetween: 1
				}
			],
			"import-x/no-restricted-paths": [
				"error", {
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
				}
			]
		}
	},
	{
		files: client,
		plugins: { "react-hooks": reactHooks },
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "error"
		}
	}
];
