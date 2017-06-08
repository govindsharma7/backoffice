module.exports = (sequelize, DataTypes) => {
  //const {models} = sequelize;
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

  Term.excludeFromSchema = true;

  // const taxonomies = {};

  Term.rawAssociations = [
    { belongsTo: 'OrderItem', options: {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'OrderItem',
    }},
    { belongsTo: 'Order', options: {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'Order',
    }},
    { belongsTo: 'Event', options: {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'Event',
    }},
  ];

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
