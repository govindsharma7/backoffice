// Config inspired from https://github.com/andywer/webpack-blocks#usage
const fs                = require('fs');
const path              = require('path');
const BabelMinifyPlugin = require('babel-minify-webpack-plugin');
const webpack           = require('webpack');

const {
  customConfig,
  createConfig,
  entryPoint,
  setOutput,
  defineConstants,
  env,
  addPlugins,
  babel,
}                       = require('webpack-blocks');

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
    // This is required for __dirname to be correct in src/vendor/payline/index.js
    node: {
      __dirname: true,
    },
    output: {
      libraryTarget: 'commonjs2',
    },
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
    // This block is required to get sendinblue's SDK to work. Waaat?
    // see https://github.com/sendinblue/APIv3-nodejs-library/issues/13
    module: {
      rules: [{
        parser: { amd: false },
      }],
    },
    // This is an example of how to replace a file in a dependency with one of
    // our own.
    // resolve: {
    //   alias: {
    //     '../services/allowed-users-finder':
    //       path.resolve(__dirname, 'src/vendor/allowed-users-finder'),
    //   },
    // },
  }),
  entryPoint('./src/index.js'),
  setOutput('./server.js'),
  defineConstants({
    'process.env.NODE_ENV': process.env.NODE_ENV,
  }),
  babel({ presets: [
    ['env', {
      targets: { node: '6.10' },
      useBuiltIns: 'usage',
    }],
  ]}),
  env('production', [
    babel({ presets: [
      ['env', {
        targets: { node: '6.10' },
        useBuiltIns: 'usage',
      }],
      // Don't minify at the file level
      ['minify', {
        mangle: false,
        deadcode: false,
      }],
    ] }),
    addPlugins(productionPlugins),
  ]),
  env('staging', [
    serverSourceMap(),
  ]),
  env('development', [
    serverSourceMap(),
  ]),
]);

function serverSourceMap(devtool = 'source-map') {
  return (context, { addPlugin }) => {
    return (prevConfig) => {
      return Object.assign(
        addPlugin(new webpack.BannerPlugin({
          banner: 'require("source-map-support").install();',
          raw: true,
          entryOnly: false,
        }))(prevConfig),
        { devtool }
      );
    };
  };
}
