module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Room',
      'beds',
      {
        type: Sequelize.ENUM(
          'double', 'simple', 'sofa', 'double+sofa', 'simple+sofa', 'simple+simple'
        ),
        defaultValue: 'double',
      }
    );
  },
  down(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Room',
      'beds',
      {
        type: Sequelize.STRING,
        defaultValue: 'double',
      },
    );
  },
};
