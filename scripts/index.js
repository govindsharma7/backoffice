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

// const watched = '--watch src --watch forest --watch __tests__';
// const nodemonInspect = `nodemon ${watched} --inspect src/index.js`;
const webpack = 'webpack --watch --config webpack.config.js';
const nodemon = 'nodemon --watch server.js --inspect server.js';
const dumpFile = 'data/data.sql';
const devDb = '.dev.sqlite';

const dbSeed =
  'node scripts/dbSeed.js';
const dbFixture =
  'node scripts/dbFixture.js';
// TODO: Make filenames configurable for the two following commands
const dbDump =
  `node scripts/dbDump.js ${dumpFile}`;
const dbFill =
  `rm -f ${devDb} && ./scripts/mysql2sqlite.sh ${dumpFile} | sqlite3 ${devDb}`;
const createCalendar =
  'node scripts/createCalendar.js';
const extractClients =
  'node scripts/extractInvoiceninja.js > data/clients.json';
const extractPortfolio =
  'node scripts/extractWordpress.js > data/portfolio.json';
const extractPictures =
  'node scripts/extractWordpressPictures.js > data/pictures.json';
const fixPicturableId =
  'node scripts/fixPicturableId.js';
const generateInvoices = 'node scripts/generateRentingInvoices.js';
const updateDraftRentOrders = 'node scripts/updateDraftRentOrders.js';
const updateLateFees = 'node scripts/updateLateFees.js';
const archivePastRentings = 'node scripts/archivePastRentings.js';
const removeDeletedAt = 'node scripts/removeDeletedAt.js';
const lint = 'eslint src forest __tests__ scripts scripts.js';
const unitTest = 'jest __tests__/unit';
const intTest = 'jest __tests__/integration';

const buildHolidays = 'node scripts/serializeFrenchHolidays > src/vendor/holidays.json';
const up = './bin/up';

const common = {
  'migration:do': sequelizeMigrationDo,
  'migration:undo': sequelizeMigrationUndo,
  'db:seed': dbSeed,
  'db:fixture': dbFixture,
  'db:dump': dbDump,
  'create:calendar': createCalendar,
  'extract:clients': extractClients,
  'extract:portfolio': extractPortfolio,
  'extract:pictures': extractPictures,
  'fix:picturableId': fixPicturableId,
  'generate:invoices': generateInvoices,
  'update:draftRentOrders': updateDraftRentOrders,
  'update:lateFees': updateLateFees,
  'archive:pastRentings': archivePastRentings,
  'remove:deletedAt': removeDeletedAt,
  'ping': 'node scripts/pingBackend.js',
};

const tests = {
  'lint': [lint],
  'test': [lint, unitTest],
  'test:watch': [`${unitTest} --watch`],
  'test:integration': [intTest],
  'test:full': [lint, 'jest'],
};

const others = {
  'start': `touch server.js && NODE_ENV=development ${webpack} & ${nodemon}`,
  'upstart': envify('up start', 'development'),
  'logs': envify('up logs -s 45m', 'development'),
  'migration:create': sequelizeMigrationCreate,
  'dev:db:copyprod': `${envify(dbDump, 'production')} && ${dbFill}`,
  'stag:db:copyprod': envify('bash ./scripts/mysqlcopy.sh', 'production'),
  'build:holidays': buildHolidays,
  'dev:deploy': './bin/up',
  'stag:deploy':
    `${envify(dbSeed, 'staging')} && ${envify(up, 'staging')} staging`,
  'prod:deploy':
    `${envify(dbSeed, 'production')} && ${envify(up, 'production')} production`,
  'stag:url': 'cross-env NODE_ENV=staging up url staging',
  'prod:url': 'cross-env NODE_ENV=production up url production',
};

module.exports = Object.assign(
  {},
  envifyAll(tests, 'test'),
  others,
  envifyAll(common, 'development', 'dev'),
  envifyAll(common, 'staging', 'stag'),
  envifyAll(common, 'production', 'prod')
);

function envifyAll(scripts, targetEnv, prefix) {
  const results = {};

  for (let scriptName in scripts) {
    let cmds = scripts[scriptName];
    let result = [];

    (Array.isArray(cmds) ? cmds : [cmds]).forEach((cmd) => {
      result.push( envify(cmd, targetEnv) );
    });

    results[prefix ? `${prefix}:${scriptName}` : scriptName] = result.join(' && ');
  }

  return results;
}

function envify(cmd, env) {
  return `cross-env NODE_ENV=${env} env-cmd ./.env.js ${cmd} ${argv.join(' ')}`;
}
