
module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Apartment',
      'district',
      Sequelize.STRING
    );
  },

  down(queryInterface) {
    queryInterface.removeColumn(
      'Apartment',
      'district'
    );
  },
};
