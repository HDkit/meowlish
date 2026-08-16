import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
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
				project: ['apps/resource/tsconfig.*?.json'],
			},
		},
	},
];
