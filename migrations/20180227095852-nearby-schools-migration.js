module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'District',
      'nearbySchools',
      Sequelize.TEXT
    );
  },

  down (queryInterface) {
    queryInterface.removeColumn('District', 'nearbySchools');
  },
};
