const dev = 'env-cmd development';
const prod = 'env-cmd production';
const staging = 'env-cmd staging';

const sequelizeFlags =
  '--config src/cli-config --models-path src/models';
const sequelizeMigrationCreate =
  `sequelize migration:create ${sequelizeFlags}`;

const nodemon = 'nodemon src/index.js';
const nodemonInspect = `${nodemon} --inspect`;

const dbSync = 'node scripts/dbSync.js';
const dbReset = 'node scripts/dbReset.js';

const lint = 'eslint .';

module.exports = {
  'lint': lint,
  'test': lint,
  'deploy': `${prod} claudia update --use-local-dependencies`,
  'extract:clients': 'node scripts/extractInvoiceninja.js > data/clients.json',
  'extract:portfolio': 'node scripts/extractWordpress.js > tmp/portfolio.json',

  'dev:start': `${dev} ${nodemon}`,
  'dev:debug': `${dev} ${nodemonInspect}`,
  'dev:sql:migration:create': `${dev} ${sequelizeMigrationCreate} --env devlopment`,
  'dev:db:sync': `${dev} ${dbSync}`,
  'dev:db:reset': `${dev} ${dbReset}`,

  'stag:start': `${staging} ${nodemon}`,
  'stag:debug': `${staging} ${nodemonInspect}`,
  'stag:sql:migration:create': `${staging} ${sequelizeMigrationCreate} --env staging`,
  'stag:db:sync': `${staging} ${dbSync}`,
  'stag:db:reset': `${staging} ${dbReset}`,
};
