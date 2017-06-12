const Promise = require('bluebird');

module.exports = {
  up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'Apartment',
        'roomCount',
        Sequelize.INTEGER
      ),
      queryInterface.addColumn(
        'Apartment',
        'floor',
        Sequelize.INTEGER
      ),
      queryInterface.addColumn(
        'Apartment',
        'code',
        Sequelize.STRING
      ),
    ]);
  },

  down(queryInterface) {
    return Promise.all([
      queryInterface.removeColumn(
        'Apartment',
        'roomCount'
      ),
      queryInterface.removeColumn(
        'Apartment',
        'floor'
      ),
      queryInterface.removeColumn(
        'Apartment',
        'code'
      ),
    ]);
  },
};
