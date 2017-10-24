const Promise = require('bluebird');

module.exports = {
  up(queryInterface, Sequelize) {
    return Promise.resolve()
      .then(() => {
        return Promise.all([
          ['Apartment', 'Room'].forEach((table) => {
            queryInterface.addColumn(
              table,
              'descriptionEs',
              Sequelize.TEXT
          );
          }),
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
          queryInterface.removeColumn('Apartment', 'district'),
        ]);
    })
    .then(() => {
      return queryInterface.sequelize.query(
        'ALTER TABLE Apartment ADD COLUMN DistrictId STRING REFERENCES District(id);');
    });
  },
  down (queryInterface) {
    return Promise.all([
      queryInterface.dropTable('District'),
      ['Apartment', 'Room'].forEach((table) => {
        queryInterface.removeColumn(table, 'descriptionEs');
      }),
      queryInterface.addColumn('Apartment', 'district'),
      queryInterface.removeColumn('Apartment', 'DistrictId'),
    ]);
  },
};
