import eslintNestJs from '@darraghor/eslint-plugin-nestjs-typed';
import eslint from '@eslint/js';
import nx from '@nx/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default [
	...nx.configs['flat/base'],
	...nx.configs['flat/typescript'],
	...nx.configs['flat/javascript'],
	{
		ignores: ['**/dist', '**/out-tsc'],
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		rules: {
			'@nx/enforce-module-boundaries': [
				'error',
				{
					enforceBuildableLibDependency: true,
					allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
					depConstraints: [
						{
							sourceTag: '*',
							onlyDependOnLibsWithTags: ['*'],
						},
					],
				},
			],
		},
	},
	...[
		eslint.configs.recommended,
		...eslintNestJs.configs.flatRecommended,
		...eslintNestJs.configs.flatNoSwagger,
		eslintPluginPrettierRecommended,
		...tseslint.configs.recommendedTypeChecked,
	].map(config => ({
		...config,
		files: [
			'**/*.ts',
			'**/*.tsx',
			'**/*.cts',
			'**/*.mts',
			'**/*.js',
			'**/*.jsx',
			'**/*.cjs',
			'**/*.mjs',
		],
		ignores: ['**/*.config.{js,ts,mjs,cjs,cts}', '**/generated/**', '**/dist', '**/out-tsc'],
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
	})),
	{
		// Override or add rules here
		files: [
			'**/*.ts',
			'**/*.tsx',
			'**/*.cts',
			'**/*.mts',
			'**/*.js',
			'**/*.jsx',
			'**/*.cjs',
			'**/*.mjs',
		],
		ignores: ['**/*.config.{js,ts,mjs,cjs,cts}', '**/generated/**', '**/dist', '**/out-tsc'],
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
		plugins: { perfectionist },
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/explicit-member-accessibility': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-parameter-properties': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/adjacent-overload-signatures': 'error',
			'@typescript-eslint/prefer-namespace-keyword': 'error',
			'no-empty-function': 'off',
			'@typescript-eslint/no-empty-function': 'error',
			'@typescript-eslint/no-inferrable-types': 'error',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-empty-interface': 'error',
			'@darraghor/nestjs-typed/injectable-should-be-provided': 'off',
			'object-shorthand': ['warn', 'never'],
			'perfectionist/sort-decorators': [
				'error',
				{
					type: 'alphabetical',
					order: 'asc',
					fallbackSort: { type: 'unsorted' },
					ignoreCase: true,
					specialCharacters: 'keep',
					groups: [
						'version',
						'method',
						'guard',
						'interceptor',
						'pipe',
						'filter',
						'class-transformer',
						'class-validator',
						// UseCls must wrap Transactional (decorators apply bottom-up), so it sorts above it.
						'cls',
						'unknown',
						'module',
						'controller',
						'injectable',
					],
					customGroups: {
						version: '^Version$',
						method: ['^Get$', '^Post$', '^Put$', '^Delete$', '^Patch$', '^Options$', '^Head$'],
						guard: '^UseGuards$',
						interceptor: '^UseInterceptors$',
						pipe: '^UsePipes$',
						filter: '^UseFilters$',
						'class-transformer': ['^Exclude$', '^Expose$', '^Transform$', '^Type$'],
						'class-validator': ['Is.*', 'Max.*', 'Min.*', 'Validate.*', 'Has.*'],
						cls: '^UseCls$',
						module: '^Module$',
						controller: '^Controller$',
						injectable: '^Injectable$',
					},
					sortOnClasses: true,
					sortOnMethods: true,
					sortOnAccessors: true,
					sortOnProperties: true,
					sortOnParameters: true,
				},
			],
			'prettier/prettier': [
				'error',
				{
					endOfLine: 'auto',
				},
			],
		},
	},
];
