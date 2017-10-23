const Promise = require('bluebird');

module.exports = {
  up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'Apartment',
        'elevator',
        Sequelize.BOOLEAN
      ),
      ['Fr', 'En'].forEach((lang) => {
        queryInterface.addColumn(
          'Apartment',
          `description${lang}`,
          Sequelize.TEXT
        );
      }),
      queryInterface.addColumn(
        'Apartment',
        'floorPlan',
        Sequelize.STRING
      ),
      ['Fr', 'En'].forEach((lang) => {
        queryInterface.addColumn(
          'Room',
          `description${lang}`,
          Sequelize.TEXT
        );
      }),
    ]);
  },
  down(queryInterface) {
    return Promise.all([
      queryInterface.removeColumn('Apartment', 'elevator'),
      queryInterface.removeColumn('Apartment', 'descriptionEn'),
      queryInterface.removeColumn('Apartment', 'descriptionFr'),
      queryInterface.removeColumn('Apartment', 'floorPlan'),
      queryInterface.removeColumn('Room', 'descriptionEn'),
      queryInterface.removeColumn('Room', 'descriptionFr'),
    ]);
  },
};
