module.exports = {
  up (queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Order',
      'status',
      {
        type: Sequelize.ENUM(
          'draft', 'active', 'cancelled'
        ),
        defaultValue: 'active',
      }
    );
  },

  down (queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Order',
      'status',
      {
        type: Sequelize.ENUM(
          'draft', 'active'
        ),
        defaultValue: 'active',
      }
    );
  },
};
