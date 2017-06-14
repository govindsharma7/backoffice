// the first three args are node, gulp and the name of the script to execute.
// pass the rest of argv to that script
const argv = process.argv.slice(3);

const sequelizeFlags =
  '--config src/cli-config.js --models-path src/models/';
const sequelizeMigrationCreate =
  `sequelize migration:create ${sequelizeFlags}`;
const sequelizeMigrationDo =
  `sequelize db:migrate ${sequelizeFlags}`;
const sequelizeMigrationUndo =
  `sequelize db:migrate:undo ${sequelizeFlags}`;

const watched = '--watch src --watch forest --watch __tests__';
const nodemonInspect = `nodemon ${watched} --inspect src/index.js`;

const dbSync = 'node scripts/dbSync.js';
const dbSeed = 'node scripts/dbSeed.js';
const dbFixture = 'node scripts/dbFixture.js';
const createCalendar = 'node scripts/createCalendar.js';
const extractClients = 'node scripts/extractInvoiceninja.js > data/clients.json';
const extractPortfolio = 'node scripts/extractWordpress.js > data/portfolio.json';
const generateInvoices = 'node scripts/generateRentingInvoices.js';

const lint = 'eslint .';
const unitTest = 'jest __tests__/unit';
const intTest = 'jest __tests__/integration';

const env2json = 'node .env.js --log > .env.json';
const claudiaUpdate = 'claudia update --config .env.json > /tmp/claudia.log';

const common = {
  'start': nodemonInspect,
  'migration:create': sequelizeMigrationCreate,
  'migration:do': sequelizeMigrationDo,
  'migration:undo': sequelizeMigrationUndo,
  'db:sync': dbSync,
  'db:seed': dbSeed,
  'db:fixture': dbFixture,
  'deploy': [env2json, claudiaUpdate],
  'create:calendar': createCalendar,
  'extract:clients': extractClients,
  'extract:portfolio': extractPortfolio,
  'generate:invoices': generateInvoices,
};

const tests = {
  'lint': [lint],
  'test': [lint, unitTest],
  'test:watch': [`${unitTest} --watch`],
  'test:integration': [intTest],
  'test:full': [lint, 'jest'],
};

module.exports = Object.assign(
  {},
  envify(tests, 'test'),
  envify(common, 'development', 'dev'),
  envify(common, 'staging', 'stag'),
  envify(common, 'production', 'prod')
);

function envify(scripts, targetEnv, prefix) {
  const results = {};

  for (let scriptName in scripts) {
    let cmds = scripts[scriptName];
    let result = [];

    (Array.isArray(cmds) ? cmds : [cmds]).forEach((cmd) => {
      result.push(
        `cross-env NODE_ENV=${targetEnv} env-cmd ./.env.js ${cmd} ${argv.join(' ')}`
      );
    });

    results[prefix ? `${prefix}:${scriptName}` : scriptName] = result.join(' && ');
  }

  return results;
}

// To create a new deploying environment, run:
// claudia create --handler=src/lambda.handler --role=chez-nestor_com-executor \
// --name=chez-nestor-<new env>_com --config=claudia.<new env>.json \
// --region=eu-west-1 --memory=256 --deploy-proxy-api
// But set AWS env variables through 'export' first, as env-cmd doesn't help here
// then create an env variable in lambda console set to <new env>
// after the creation succeeded, transfer the content of claudia.<new env>.json
// to env.js
