const flags = process.argv.filter((flag) => {
  return /^--?\w/.test(flag);
}).join(' ');

const sequelizeFlags =
  '--config src/cli-config --models-path src/models';
const sequelizeMigrationCreate =
  `sequelize migration:create ${sequelizeFlags} --env $NODE_ENV`;

const watched = '--watch src --watch forest --watch __tests__';
const nodemonInspect = `nodemon ${watched} --inspect src/index.js`;

const dbSync = 'node scripts/dbSync.js';
const dbSeed = 'node scripts/dbSeed.js';
const dbReset = 'node scripts/dbReset.js';
const dbFixture = 'node scripts/dbFixture.js';
const createCalendar = 'node scripts/createCalendar.js';
const extractClients = 'node scripts/extractInvoiceninja.js > data/clients.json';
const extractPortfolio = 'node scripts/extractWordpress.js > tmp/portfolio.json';
const generateInvoices = 'node scripts/generateRentingInvoices.js';

const lint = 'eslint .';
const unitTest = 'jest __tests__/unit';
const intTest = 'jest __tests__/integration';

const claudiaUpdate =
  'claudia update --use-local-dependencies --config claudia.$NODE_ENV.json';

const common = {
  'start': nodemonInspect,
  'sql:migration:create': sequelizeMigrationCreate,
  'db:sync': dbSync,
  'db:seed': dbSeed,
  'db:fixture': dbFixture,
  'deploy': claudiaUpdate,
  'create:calendar': createCalendar,
  'extract:clients': extractClients,
  'extract:portfolio': extractPortfolio,
  'generate:invoices': generateInvoices,
};

const tests = {
  'lint': [lint],
  'test': [lint, dbReset, unitTest],
  'test:watch': [dbReset, `${unitTest} --watch`],
  'test:integration': [dbReset, intTest],
  'test:full': [lint, dbReset, 'jest'],
};

module.exports = Object.assign(
  {},
  envify(tests, 'test'),
  envify(common, 'development', 'dev'),
  envify(common, 'staging', 'stag'),
  envify(common, 'production', 'prod')
);

function envify(scripts, NODE_ENV, prefix) {
  const results = {};

  for (let scriptName in scripts) {
    let cmds = scripts[scriptName];
    let result = [];

    (Array.isArray(cmds) ? cmds : [cmds]).forEach((cmd) => {
      result.push(`cross-env NODE_ENV=${NODE_ENV} env-cmd ./.env.js ${cmd} ${flags}`);
    });

    results[prefix ? `${prefix}:${scriptName}` : scriptName] = result.join(' && ');
  }

  return results;
}

// To create a new deploying environment, run:
// claudia create --handler=src/lambda.handler --role=chez-nestor_com-executor \
// --name=chez-nestor-<new env>_com --config=claudia.<new env>.json \
// --region=eu-west-1 --memory=256 --deploy-proxy-api
// But set AWS env variables thrugh 'export' first, as env-cmd doesn't help here
// then create an env variable in lambda console set to <new env>
