const Promise       = require('bluebird');
const D             = require('date-fns');
const Liana           = require('forest-express-sequelize');

const makePublic    = require('../../middlewares/makePublic');
const fetch         = require('../../vendor/fetch');
const config        = require('../../config');
const Utils       = require('../../utils');

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

  Term.routes = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.get('/forest/Term', makePublic);

    app.post('/forest/amIAdmin', makePublic, (req, res) => {
      return Promise.resolve()
      .then(() => {
        return fetch(`${config.api.url}/forest/sessions`, {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(Object.assign(
            {},
            req.body,
            { renderingId: config.api.renderingId })),
        });
      })
      .then((response) => {
        if ( !response.ok ) {
          /* eslint-disable promise/no-nesting */
          return response.text()
            .then((message) => {
              throw new Error(message);
          });
          /* eslint-enable promise/no-nesting */
        }
        return response.json();
      })
      .then((result) => {
        return res.cookie(
          'authorized',
          `Bearer ${result.token}`,
          { expires: D.addDays(Date.now(), 30) }).send(result);
      })
      .catch((e) => {
        return res.status(400).send(e);
      });
    });

    app.post('/forest/actions/public/updateTerms', LEA, (req, res) => {
      const { roomId, apartmentId, ApartmentFeatures, RoomFeatures } = req.body;

      Promise.resolve()
        .then(() => {
          return Term.destroy({
            where: {
              $or: [{
                TermableId: roomId,
                taxonomy:  { $like: 'room-features-%' },
              }, {
                TermableId: apartmentId,
                taxonomy: { $like: 'apartment-features-%' },
              }],
            },
          });
        })
        .then(() => {
          return Promise.all([
            RoomFeatures.map(({name, taxonomy, termable }) => {
              return Term.create({
                name,
                taxonomy,
                termable,
                TermableId: roomId,
              });
            }),
            ApartmentFeatures.map(({name, taxonomy, termable }) => {
              return Term.create({
                name,
                taxonomy,
                termable,
                TermableId: apartmentId,
              });
            }),
          ]);
        })
        .then(Utils.createSuccessHandler(res, 'Terms'))
        .catch((e) => {
          return res.status(400).send(e);
        });
    });
  };

  return Term;
};
