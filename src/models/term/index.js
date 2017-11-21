const Promise       = require('bluebird');
const { DataTypes } = require('sequelize');
const sequelize     = require('../sequelize');
const routes        = require('./routes');

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
// const taxonomies = {};

Term.associate = (models) => {
  Term.belongsTo(models.Room, {
    foreignKey: 'TermableId',
    constraints: false,
    as: 'Room',
  });
  Term.belongsTo(models.Apartment, {
    foreignKey: 'TermableId',
    constraints: false,
    as: 'Apartment',
  });
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
  Term.belongsTo(models.District, {
    foreignKey: 'TermableId',
    constraints: false,
    as: 'District',
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
  return sequelize.transaction((transaction) =>
    Promise.resolve()
      .then(() => Term.destroy({
        where: {
          taxonomy: this.taxonomy,
          termable: this.termable,
          TermableId: this.TermableId,
        },
        transaction,
      }))
      .then(() => Term.create({
        name,
        taxonomy: this.taxonomy,
        TermableId: this.TermableId,
        termable: this.termable,
      }, {
        transaction,
      })
    )
  );
};

Term.excludeFromSchema = true;
Term.routes = routes;

module.exports = Term;
