const Promise = require('bluebird');

module.exports = {
  up(queryInterface, Sequelize) {
   return Promise.resolve()
    .then(() => {
      return Promise.all([
        queryInterface.addColumn(
          'Room',
          'descriptionEs',
          Sequelize.TEXT
        ),
        queryInterface.addColumn(
          'Apartment',
          'descriptionEs',
          Sequelize.TEXT
        ),
        queryInterface.createTable(
          'District',
          {
            id: {
              type: Sequelize.STRING,
              primaryKey: true,
            },
            createdAt: {
              type: Sequelize.DATE,
            },
            updatedAt: {
              type: Sequelize.DATE,
            },
            label: Sequelize.STRING,
            descriptionFr: Sequelize.TEXT,
            descriptionEn: Sequelize.TEXT,
            descriptionEs: Sequelize.TEXT,
          }),
     ]);
    })
    .then(() => {
      return queryInterface.sequelize.query(
        'ALTER TABLE Apartment ADD COLUMN DistrictId STRING REFERENCES District(id);');
    });
  },
  down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.dropTable('District'),
      ['Apartment', 'Room'].forEach((table) => {
        queryInterface.removeColumn(table, 'descriptionEs');
      }),
      queryInterface.addColumn('Apartment', 'district', Sequelize.STRING),
      queryInterface.removeColumn('Apartment', 'DistrictId'),
    ]);
  },
};
