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

const entryPoint = 'src/index.js';
const nodemonInspect =
  `nodemon --watch src --watch forest --watch __tests__ --inspect ${entryPoint}`;

const dbSync = 'node scripts/dbSync.js';
const dbSeed = 'node scripts/dbSeed.js';
const dbReset = 'node scripts/dbReset.js';
const dbFixture = 'node scripts/dbFixture.js';

const lint = 'eslint .';
const unitTest = 'jest __tests__/unit';
const intTest = 'jest __tests__/integration';

const claudiaUpdate = 'claudia update --use-local-dependencies';

module.exports = {
  'lint': `${lint} ${flags}`,
  'test': `${lint} && ${env.test} ${dbReset} && ${env.test} ${unitTest}`,
  'test:watch': `${env.test} ${dbReset} && ${env.test} ${unitTest} --watch`,
  'test:integration': `${env.test} ${dbReset} && ${env.test} ${intTest}`,
  'test:full': `${lint} && ${env.test} ${dbReset} && ${env.test} jest`,

  'extract:clients':
    `${env.prod} node scripts/extractInvoiceninja.js > data/clients.json`,
  'extract:portfolio':
    `${env.prod} node scripts/extractWordpress.js > tmp/portfolio.json`,
  'generate:rentorders':
    `${env.dev} node scripts/generateRentingInvoices.js`,

  'dev:start': `${env.dev} ${nodemonInspect}`,
  'dev:sql:migration:create':
    `${env.dev} ${sequelizeMigrationCreate} --env devlopment`,
  'dev:db:sync': `${env.dev} ${dbSync}`,
  'dev:db:seed': `${env.dev} ${dbSeed}`,
  'dev:db:fixture': `${env.dev} ${dbFixture}`,

  'stag:start': `${env.staging} ${nodemonInspect}`,
  'stag:sql:migration:create':
    `${env.staging} ${sequelizeMigrationCreate} --env staging`,
  'stag:db:sync': `${env.staging} ${dbSync}`,
  'stag:db:fixture': `${env.staging} ${dbFixture} ${flags}`,
  'stag:deploy': `${env.staging} ${claudiaUpdate} --config claudia.stag.json`,

  'prod:db:fixture': `${env.prod} ${dbFixture} ${flags}`,
  'prod:deploy': `${env.prod} ${claudiaUpdate}`,
};

// To create a new deploying environment, run:
// claudia create --handler=src/lambda.handler --role=chez-nestor_com-executor \
// --name=chez-nestor-<new env>_com --config=claudia.<new env>.json \
// --region=eu-west-1 --memory=256 --deploy-proxy-api
// But set AWS env variables thrugh 'export' first, as env-cmd doesn't help here
// then create an env variable in lambda console set to <new env>
