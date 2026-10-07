import { defineConfig } from "oxlint";

export default defineConfig( {
	plugins: [ "oxc", "typescript", "unicorn", "react", "import", "vitest" ],
	jsPlugins: [
		"@stylistic/eslint-plugin",
		{ name: "effect", specifier: "@effect/eslint-plugin" },
		{ name: "perfectionist", specifier: "eslint-plugin-perfectionist" }
	],
	categories: {
		correctness: "warn"
	},
	rules: {
		"@stylistic/space-in-parens": [ "error", "always" ],
		"@stylistic/object-curly-spacing": [ "error", "always" ],
		"@stylistic/array-bracket-spacing": [ "error", "always" ],
		"@stylistic/template-curly-spacing": [ "error", "always" ],
		"@stylistic/quotes": [ "error", "double" ],
		"@stylistic/semi": [ "error", "always" ],
		"@stylistic/comma-dangle": [ "error", "never" ],
		"@stylistic/eol-last": [ "error", "always" ],
		"@stylistic/no-multiple-empty-lines": [
			"error",
			{
				max: 2
			}
		],
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
		"@stylistic/no-trailing-spaces": [
			"error",
			{
				skipBlankLines: false
			}
		],
		"import/consistent-type-specifier-style": [ "error", "prefer-top-level" ],
		"typescript/consistent-type-imports": [
			"error",
			{
				prefer: "type-imports",
				fixStyle: "separate-type-imports"
			}
		],
		"sort-imports": [
			"error",
			{
				ignoreDeclarationSort: true,
				ignoreMemberSort: false,
				ignoreCase: true
			}
		],
		"perfectionist/sort-imports": [
			"error",
			{
				customGroups: [
					{ groupName: "platform", elementNamePattern: [ "^bun$", "^bun:", "^node$", "^node:" ] },
					{ groupName: "effect/submodules", elementNamePattern: [ "^@effect" ] },
					{ groupName: "effect/subpackages", elementNamePattern: [ "^effect/[a-z]" ] },
					{ groupName: "effect", elementNamePattern: [ "^effect" ] },
					{ groupName: "bun", elementNamePattern: [ "^bun$", "^bun:" ] },
					{ groupName: "s2h", elementNamePattern: [ "^@s2h" ] },
					{ groupName: "tests", elementNamePattern: [ "^@tests" ] }
				],
				groups: [
					"platform",
					"effect",
					"effect/submodules",
					"effect/subpackages",
					"s2h",
					"tests",
					[ "value-builtin", "type-builtin" ],
					[ "value-external", "type-external" ],
					[ "value-internal", "type-internal" ],
					"unknown"
				],
				newlinesBetween: 1
			}
		],
		"vitest/no-standalone-expect": [
			"warn",
			{
				additionalTestBlockFunctions: [ "it.effect", "it.live", "it.scoped", "it.flakyTest" ]
			}
		],
		"effect/no-import-from-barrel-package": [
			"error",
			{
				packageNames: [
					"effect",
					"@effect/platform-bun",
					"@effect/sql-pg",
					"effect/http",
					"effect/http-api",
					"effect/cli",
					"effect/persistence",
					"effect/reactivity"
				]
			}
		],
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
		"react/rules-of-hooks": "error",
		"react/only-export-components": [ "warn", { allowConstantExport: true } ]
	}
} );
