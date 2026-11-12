import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		files: ['**/*.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
				},
			],
		},
		languageOptions: {
			parser: await import('jsonc-eslint-parser'),
		},
	},
	{
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
				projectService: false,
				project: ['libs/telemetry/tsconfig.*?.json'],
			},
		},
	},
];
