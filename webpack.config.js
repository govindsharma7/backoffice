// Config inspired from https://github.com/andywer/webpack-blocks#usage
const fs = require('fs');
const BabelMinifyPlugin = require('babel-minify-webpack-plugin');

const {
  customConfig,
  createConfig,
  entryPoint,
  setOutput,
  defineConstants,
  env,
  sourceMaps,
  addPlugins,
}                   = require('@webpack-blocks/webpack2');
const babel         = require('@webpack-blocks/babel6');

// const commonPlugins = [
// ];

// Minify after concat
const productionPlugins = [
  new BabelMinifyPlugin({
    mangle: true,
    deadcode: true,
  }),
];

module.exports = createConfig([
  customConfig({
    target: 'node',
    externals:
      // make all node modules external
      fs.readdirSync('node_modules')
        .filter((name) => { return name !== '.bin'; })
        // replace effing Winston-based logger in forest-express with the console
        .concat((context, request, callback) => {
          if (/\.\/(services\/)?(logger)$/.test(request)) {
            return callback(null, 'console');
          }
          return callback();
        }),
    output: {
      libraryTarget: 'commonjs2',
    },
    // This block is required to get sendinblue's SDK to work. Waaat?
    // see https://github.com/sendinblue/APIv3-nodejs-library/issues/13
    module: {
      rules: [{
        parser: { amd: false },
      }],
    },
  }),
  entryPoint('./src/index.js'),
  setOutput('./server.js'),
  defineConstants({
    'process.env.NODE_ENV': process.env.NODE_ENV,
  }),
  env('production', [
    babel({ presets: [
      'env',
      // Don't minify at the file level
      ['minify', {
        mangle: false,
        deadcode: false,
      }],
    ] }),
    addPlugins(productionPlugins),
  ]),
  env('staging', [
    babel({ presets: ['env'] }),
    sourceMaps(),
  ]),
  env('development', [
    babel({ presets: ['env'] }),
    sourceMaps(),
  ]),
  // addPlugins(commonPlugins),
]);
