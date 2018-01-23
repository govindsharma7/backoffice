module.exports = {
  up(queryInterface, Sequelize) {
    const paymentTypes = Sequelize.ENUM.apply(Sequelize,
      'card,sepa,manual,manual-card,manual-cash,manual-transfer,manual-cheque'.split(',')
    );

    queryInterface.changeColumn(
      'Payment',
      'type',
      {
        type: paymentTypes,
        defaultValue: 'manual-card',
      }
    );
  },

  down(queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Payment',
      'type',
      {
        type: Sequelize.ENUM('card', 'sepa', 'manual'),
        defaultValue: 'manual-card',
      }
    );
  }
};
