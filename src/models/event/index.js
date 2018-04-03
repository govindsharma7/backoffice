const { DataTypes }         = require('sequelize');
const { TRASH_SCOPES }      = require('../../const');
const Zapier                = require('../../vendor/zapier');
const { required }          = require('../../utils');
const Utils                 = require('../../utils');
const sequelize             = require('../sequelize');
const collection            = require('./collection');
const hooks                 = require('./hooks');

const { methodify } = Utils;

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
    allowNull: false,
  },
  EventableId: {
    type:                     DataTypes.STRING,
    required: true,
    allowNull: false,
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
};

Event.zapCreatedOrUpdated = function({ event = required() }) {
  return Zapier.post('zdso65', event.dataValues || event);
};
methodify(Event, 'zapCreatedOrUpdated');

Event.zapDeleted = function({ event = required() }) {
  return Zapier.post('zdso65', { id: event.id, delete: true });
};
methodify(Event, 'zapDeleted');

Event.collection = collection;
Event.routes = (app) => {
  Utils.addRestoreAndDestroyRoutes(app, Event);
};
Event.hooks = hooks;

module.exports = Event;
