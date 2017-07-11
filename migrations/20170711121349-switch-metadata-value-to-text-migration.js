module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Metadata',
      'value',
      { type: Sequelize.TEXT }
    );
  },

  down(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Metadata',
      'value',
      { type: Sequelize.STRING }
    );
  },
};
