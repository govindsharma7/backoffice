module.exports = {
  up(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Apartment',
      'addressCity',
      { type: Sequelize.ENUM(
        'lyon',
        'montpellier',
        'paris',
        'lille',
        'bordeaux',
        'toulouse',
        'madrid'
      ) }
    );
  },

  down(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Apartment',
      'addressCity',
      { type: Sequelize.ENUM(
        'lyon',
        'montpellier',
        'paris'
      ) }
    );
  }
};
