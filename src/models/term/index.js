const Promise = require('bluebird');

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
    Term.belongsTo(models.Renting, {
      foreignKey: 'TermableId',
      constraints: false,
      as: 'Renting',
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

  Term.prototype.createOrUpdate = function(name) {
    return sequelize.transaction((transaction) => {
      return Promise.resolve()
        .then(() => {
          return Term.destroy({
            where: {
              taxonomy: this.taxonomy,
              termable: this.termable,
              TermableId: this.TermableId,
            },
            transaction,
          });
        })
        .then(() => {
          return Term.create({
            name,
            taxonomy: this.taxonomy,
            TermableId: this.TermableId,
            termable: this.termable,
          }, {transaction});
        });
    });
  };

  return Term;
};
