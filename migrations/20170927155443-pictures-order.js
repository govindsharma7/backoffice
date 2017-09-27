module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.addColumn(
    'Picture',
    'order',
    Sequelize.INTEGER
    );
  },

  down(queryInterface) {
    queryInterface.removeColumn(
    'Picture',
    'order'
    );
  },
};
