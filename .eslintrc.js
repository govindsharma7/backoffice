module.exports = {
  parser: 'babel-eslint',
  parserOptions: {
    'ecmaVersion': 6,
    'sourceType': 'module',
    'ecmaFeatures': {
      'jsx': true
    }
  },
  extends: [
    'eslint:recommended',
    'plugin:promise/recommended',
  ],
  plugins: [
    'react',
    'mocha',
    'import',
    'promise'
  ],
  settings: {
    'import/resolver': 'babel-root-import',
    'import/ignore': [
      'webpack.config.json'
    ]
  },
  env: {
    'browser': true,
    'amd': true,
    'es6': true,
    'node': true,
    'mocha': true
  },
  rules: {
    // Possibe errors
    'no-await-in-loop': 'error',
    'no-compare-neg-zero': 'error',
    'no-console': ['warn', { allow: ['error'] }],
    'no-template-curly-in-string': 'error',

    // Best practices
    'array-callback-return': 'error',
    'block-scoped-var': 'error', // ??
    'complexity': ['error', {max: 10}],
    'consistent-return': 'error',
    'curly': 'error',
    'default-case': 'error',
    'dot-location': ['error', 'property'],
    'dot-notation': ['error', { "allowPattern": "^[a-z]+(_[a-z]+)+$" }],
    'eqeqeq': ['error', 'smart'],
    'no-alert': 'error',
    'no-caller': 'error',
    'no-else-return': 'error',
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-floating-decimal': 'error',
    'no-implicit-coercion': 'error',
    'no-implied-eval': 'error',
    'no-invalid-this': 'error',
    'no-iterator': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'warn',
    // TODO: restore this rule later. Right now it's really noisy
    //'no-magic-numbers': ['warn', { ignoreArrayIndexes: true, ignore: [-1,0,1,100]}],
    'no-multi-spaces': ['error', {exceptions: {
      Property: true,
      VariableDeclarator: true,
      ImportDeclaration: true,
    }}],
    'no-multi-str': 'error',
    'no-param-reassign': 'error',
    'no-proto': 'error',
    // TODO: restore this rule later. Right now it's really noisy
    //'no-return-assign': 'warn',
    'no-return-await': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'warn',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',
    'no-useless-return': 'error',
    'no-with': 'error',
    'prefer-promise-reject-errors': ['error', {allowEmptyReject: true}],
    'require-await': 'error',
    'vars-on-top': 'error',

    // Strict Mode
    'strict': ['error', 'never'],

    // Variables
    'no-shadow': 'warn',
    'no-shadow-restricted-names': 'error',
    'no-undef-init': 'error',
    'no-use-before-define': ['error', {functions: false}],

    // Stylistic
    'array-bracket-spacing': ['error', 'never'],
    'block-spacing': ['error', 'always'],
    'brace-style': [ 'error', 'stroustrup', { 'allowSingleLine': true } ],
    'camelcase': ['error', {properties: 'always'}],
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': 'error',
    'comma-style': ['error', 'last'],
    'computed-property-spacing': ['error', 'never'],
    'consistent-this': ["error", "self"],

    'semi': ['error', 'always'],
    'one-var': ['error', 'never'],
    // Do not disable max-len. If your code exceeds 90 chars, then there's no arguing that you are making it hard to read for other devs. See?
    'max-len': ['error', { code: 90, ignoreUrls: true }],
    'newline-after-var': ['error', 'always'],
    'quotes': ['error', 'single'],
    'eol-last': ['error', 'always'],
    'func-call-spacing': ['error', 'never'],
    // TODO: restore this rule later. Right now it's really noisy
    //'indent': ['error', 2],

    'space-before-blocks': ['error', 'always'],
    'keyword-spacing': ['error', { before: true, after: true }],
    'space-infix-ops': ['error'],

    // TODO: restore this rule later. Right now it's really noisy
    //'no-underscore-dangle': ['warn'],
    'no-trailing-spaces': ['error'],

    // ECMAScript 6
    'arrow-body-style': ['error', 'always'],
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': ['error'],
    'object-shorthand': ['error', 'always'],
    'prefer-destructuring': ['error', { array: false }],
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'prefer-template': 'error',

    // React
    'react/jsx-uses-react': 1,
    'react/jsx-uses-vars': 1,

    // Mocha
    'mocha/no-exclusive-tests': 'error',

    // Import
    // check import resolution on es6 imports only
    'import/no-unresolved': [2, {commonjs: false, amd: false, }],
    'import/named': 2,
    'import/default': 2,
    'import/namespace': 'warn',
    'import/no-absolute-path': 2,
    'import/no-dynamic-require': 2,
    'import/export': 2,
    'import/no-named-as-default': 2,
    'import/no-named-as-default-member': 2,
    'import/no-deprecated': 2,
    'import/no-mutable-exports': 2,
    // 'import/no-nodejs-modules': 2,
    'import/first': 2,
    'import/no-duplicates': 2,
    'import/order': 2,
    'import/newline-after-import': 2,
    // surprisingly, those two rules don't work
    'import/no-webpack-loader-syntax': 'off',
    'import/unambiguous': 'off',

    // Promise
    'promise/no-native': 'error',
    'promise/avoid-new': 'error',
  },
  'globals': {
    expect: false,
    beforeAll: false
  }
};
