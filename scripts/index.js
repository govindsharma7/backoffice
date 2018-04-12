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
const dbSync =
  'node scripts/dbSync.js';
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
const deletePictures = 'node scripts/deletePictures.js';
const updateLateFees = 'node scripts/updateLateFees.js';
const rentInvoiceReminder = 'node scripts/rentInvoiceReminder.js';
const archivePastRentings = 'node scripts/archivePastRentings.js';
const removeDeletedAt = 'node scripts/removeDeletedAt.js';
const lint = 'eslint src forest __tests__ scripts scripts.js';
// This maxWorkers flag is the right one for Travis-CI's free plan
// and my dual core dev machine.
const unitTest = 'jest __tests__/unit --maxWorkers=2';
const intTest = 'jest __tests__/integration';
const removeClientsFromSendinBlue = 'node scripts/removeClientsFromSendinBlue';
const buildHolidays = 'node scripts/serializeFrenchHolidays > src/vendor/holidays.json';
const up = './bin/up';

const common = {
  'migration:do': sequelizeMigrationDo,
  'migration:undo': sequelizeMigrationUndo,
  'db:seed': dbSeed,
  'db:sync': dbSync,
  'db:fixture': dbFixture,
  'create:calendar': createCalendar,
  extractClients,
  extractPortfolio,
  extractPictures,
  fixPicturableId: 'node scripts/fixPicturableId.js',
  fixLatLng: 'node scripts/fixLatLng.js',
  fixEventType: 'node scripts/fixEventType.js',
  fixFeatures: 'node scripts/fixFeatures.js',
  fixVillebois: 'node scripts/fixVillebois.js',
  generateInvoices: 'node scripts/generateRentingInvoices.js',
  generateDescriptions: 'node scripts/generateDescriptions.js',
  deletePictures,
  updateLateFees,
  'invoice:reminder': rentInvoiceReminder,
  'archive:pastRentings': archivePastRentings,
  'remove:deletedAt': removeDeletedAt,
  'remove:clientSendinBlue': removeClientsFromSendinBlue,
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
  'logs': envify('up logs -s 15m', 'development'),
  'stag:logs': envify('up logs -s 15m -f staging', 'development'),
  'prod:logs': envify('up logs -s 15m -f production', 'development'),
  'migration:create': sequelizeMigrationCreate,
  'dev:db:copyprod':
    `${envify(dbDump, 'production')} && ${dbFill} && ${envify(dbSync, 'development')}`,
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
