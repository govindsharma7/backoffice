module.exports = (sequelize, DataTypes) => {
  const Term = sequelize.define('Term', {
    name: {
      primaryKey: true,
      type:                     DataTypes.STRING,
    },
    taxonomy: {
      primaryKey: true,
      type:                     DataTypes.STRING,
    },
    TermableId: {
      primaryKey: true,
      type:                     DataTypes.STRING,
    },
    termable: {
      type:                     DataTypes.STRING,
      required: true,
      allowNull: false,
    },
  });
  const {models} = sequelize;
  // const taxonomies = {};

  Term.associate = () => {
    Term.belongsTo(models.OrderItem, {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'OrderItem',
    });
    Term.belongsTo(models.Order, {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'Order',
    });
    Term.belongsTo(models.Event, {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'Event',
    });
  };

  // Term.addTaxonomy = function(options) {
  //   const {name} = options;
  //
  //   Term.addScope(name, {
  //     where: { name },
  //   });
  //
  //   taxonomies[name] = options;
  // };
  //
  // Term.hook('beforeCreate', (term) => {
  //
  // });

  return Term;
};
