const env = {
  test: 'env-cmd test',
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
const unitTest = 'jest __tests__/unit';

module.exports = {
  'lint': lint,
  'test': `${lint} && ${env.test} ${dbReset} && ${env.test} ${unitTest}`,
  'test:watch': `${env.test} ${dbReset} && ${env.test} ${unitTest} --watch`,
  'test:full': `${lint} && ${env.test} ${dbReset} && ${env.test} jest`,
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
  'dev:db:seed': `${env.dev} ${dbReset}`,

  'stag:start': `${env.staging} ${nodemon}`,
  'stag:debug': `${env.staging} ${nodemonInspect}`,
  'stag:sql:migration:create':
    `${env.staging} ${sequelizeMigrationCreate} --env staging`,
  'stag:db:sync': `${env.staging} ${dbSync}`,
  'stag:db:seed': `${env.staging} ${dbReset} ${flags}`,
};
