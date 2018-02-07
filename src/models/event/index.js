const { DataTypes }         = require('sequelize');
const { TRASH_SCOPES }      = require('../../const');
const Zapier                = require('../../vendor/zapier');
const { required }          = require('../../utils');
const Utils                 = require('../../utils');
const sequelize             = require('../sequelize');
const collection            = require('./collection');
const hooks                 = require('./hooks');

const postToZapier = Zapier.poster('zdso65');

const Event = sequelize.define('Event', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  startDate: {
    type:                     DataTypes.DATE,
    required: true,
    allowNull: false,
  },
  endDate: {
    type:                     DataTypes.DATE,
    required: true,
    allowNull: false,
  },
  summary: {
    type:                     DataTypes.STRING,
  },
  description:  {
    type:                     DataTypes.STRING,
  },
  type: {
    type:                     DataTypes.ENUM('checkin', 'checkout', 'deposit-refund'),
    required: true,
  },
  location:                   DataTypes.STRING,
  eventable: {
    type:                     DataTypes.STRING,
    required: true,
  },
  EventableId: {
    type:                     DataTypes.STRING,
    required: true,
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active'),
    required: true,
    allowNull: false,
    defaultValue: 'active',
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Event.associate = (models) => {
  Event.belongsTo(models.Renting, {
    foreignKey: 'EventableId',
    constraints: false,
    as: 'Renting',
  });
  Event.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'Event' },
  });

  Event.addScope('event-category', {
    attributes: { include: [
      [sequelize.col('Terms.name'), 'category'],
    ]},
    include: [{
      required: false,
      model: models.Term,
      where: { taxonomy: 'event-category' },
    }],
  });
};

Event.prototype.zapCreatedOrUpdated = function(args) {
  return Event.zapCreatedOrUpdated(Object.assign({ event: this }, args));
};
Event.zapCreatedOrUpdated = function({ event = required() }) {
  return postToZapier(event.dataValues || event);
};

Event.prototype.zapDeleted = function(args) {
  return Event.zapDeleted(Object.assign({ event: this }, args));
};
Event.zapDeleted = function({ event = required() }) {
  return postToZapier({ id: event.id, delete: true });
};

Event.collection = collection;
Event.routes = (app) => {
  Utils.addRestoreAndDestroyRoutes(app, Event);
};
Event.hooks = hooks;

module.exports = Event;
