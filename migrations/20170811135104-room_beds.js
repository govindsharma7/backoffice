module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Room',
      'beds',
      Sequelize.STRING
    );
  },

  down(queryInterface) {
    queryInterface.removeColumn(
      'Room',
      'beds'
    );
  },
};
