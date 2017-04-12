const env = {
  test: 'env-cmd development',
  dev: 'env-cmd development',
  prod: 'env-cmd production',
  staging: 'env-cmd staging',
};

const flags = process.argv.filter((flag) => {
  return /^--?\w/.test(flag);
}).join(' ');

const sequelizeFlags =
  '--config src/cli-config --models-path src/models';
const sequelizeMigrationCreate =
  `sequelize migration:create ${sequelizeFlags}`;

const nodemon = 'nodemon src/index.js';
const nodemonInspect = `${nodemon} --inspect`;

const dbSync = 'node scripts/dbSync.js';
const dbReset = 'node scripts/dbReset.js';

const lint = 'eslint .';
const test = 'jest';

module.exports = {
  'lint': lint,
  'test': `${lint} && ${env.test} ${dbReset} &&  ${env.test} ${test}`,
  'test:watch': `${env.test} ${dbReset} && ${env.test} ${test} --watch`,
  'deploy': `${env.prod} claudia update --use-local-dependencies`,
  'extract:clients':
    `${env.staging} node scripts/extractInvoiceninja.js > data/clients.json`,
  'extract:portfolio':
    `${env.staging} node scripts/extractWordpress.js > tmp/portfolio.json`,

  'dev:start': `${env.dev} ${nodemon}`,
  'dev:debug': `${env.dev} ${nodemonInspect}`,
  'dev:sql:migration:create':
    `${env.dev} ${sequelizeMigrationCreate} --env devlopment`,
  'dev:db:sync': `${env.dev} ${dbSync}`,
  'dev:db:reset': `${env.dev} ${dbReset}`,

  'stag:start': `${env.staging} ${nodemon}`,
  'stag:debug': `${env.staging} ${nodemonInspect}`,
  'stag:sql:migration:create':
    `${env.staging} ${sequelizeMigrationCreate} --env staging`,
  'stag:db:sync': `${env.staging} ${dbSync}`,
  'stag:db:reset': `${env.staging} ${dbReset} ${flags}`,
};
