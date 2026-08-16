const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const path = require('path');
const { join } = require('path');

class SwcrcDirPlugin {
	apply(compiler) {
		const rule = compiler.options.module.rules.find(rule => rule?.loader?.includes('swc-loader'));

		if (rule) {
			rule.options = rule.options || {};
			rule.options.configFile = path.join(compiler.context, '.swcrc');
		}
	}
}

module.exports = {
	output: {
		path: join(__dirname, '../../dist/apps/forum'),
		clean: true,
		...(process.env.NODE_ENV !== 'production' && {
			devtoolModuleFilenameTemplate: '[absolute-resource-path]',
		}),
	},
	plugins: [
		new NxAppWebpackPlugin({
			target: 'node',
			compiler: 'swc',
			main: './src/main.ts',
			tsConfig: './tsconfig.app.json',
			// assets: ['./src/assets'],
			optimization: false,
			outputHashing: 'none',
			generatePackageJson: true,
			sourceMap: true,
		}),
		new SwcrcDirPlugin(),
	],
};
