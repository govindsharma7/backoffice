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

const commonPlugins = [
];

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
  }),
  entryPoint('./src/index.js'),
  setOutput('./server.js'),
  defineConstants({
    'process.env.NODE_ENV': process.env.NODE_ENV
  }),
  env('production', [
    babel({ presets: [
      'env',
      ['minify', {
        mangle: false,
        deadcode: false,
      }],
    ] }),
    addPlugins(productionPlugins),
  ]),
  env('development', [
    babel({ presets: ['env'] }),
    sourceMaps(),
  ]),
  addPlugins(commonPlugins),
]);
