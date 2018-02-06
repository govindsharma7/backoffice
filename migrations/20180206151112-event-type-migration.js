module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'Event',
      'type',
      Sequelize.ENUM('checkin', 'checkout', 'deposit-refund')
    );
  },

  down (queryInterface) {
    queryInterface.removeColumn('Event', 'type');
  },
};
