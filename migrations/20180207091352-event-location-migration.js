module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'Event',
      'location',
      Sequelize.STRING
    );
  },

  down (queryInterface) {
    queryInterface.removeColumn('Event', 'location');
  },
};
