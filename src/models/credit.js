const Liana          = require('forest-express');
const {TRASH_SCOPES} = require('../const');
const Utils          = require('../utils');

module.exports = (sequelize, DataTypes) => {
  const Credit = sequelize.define('Credit', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: true,
      allowNull: false,
    },
    reason: {
      type:                     DataTypes.STRING,
      require: false,
    },
    paylineId: {
      type:                     DataTypes.STRING,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
      allowNull: false,
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Credit.associate = () => {
    Credit.belongsTo(models.Payment, {
      constraints: false,
    });
    Credit.belongsTo(models.Order, {
      constraints: false,
    });

    Credit.addScope('order', {
      include: [{
        model: models.Payment,
      }],
    });
  };

  Credit.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/restore-credit', LEA, (req, res) => {
      Credit
        .findAll({
          where: { id: { $in: req.body.data.attributes.ids } },
          paranoid: false,
        })
        .then((credits) => {
          return Utils.restore(credits);
        })
        .then((value) => {
          return Utils.restoreSuccessHandler(res, `${value} Credits`);
        })
        .catch(Utils.logAndSend(res));
    });

    app.post('/forest/actions/destroy-credit', LEA, (req, res) => {
      Credit
        .findAll({
          where: { id: { $in: req.body.data.attributes.ids } },
          paranoid: false,
        })
        .then((credits) => {
          return Utils.destroy(credits);
        })
        .then((value) => {
          return Utils.destroySuccessHandler(res, `${value} Credits`);
        })
        .catch(Utils.logAndSend(res));
    });
  };

  return Credit;
};
