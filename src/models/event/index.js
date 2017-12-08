const { DataTypes }         = require('sequelize');
const Calendar              = require('googleapis').calendar('v3');
const Promise               = require('bluebird');
const { TRASH_SCOPES }      = require('../../const');
const jwtClient             = require('../../vendor/googlecalendar');
const Utils                 = require('../../utils');
const sequelize             = require('../sequelize');
const models                = require('../models'); //!\ Destructuring forbidden /!\
const collection            = require('./collection');
const hooks                 = require('./hooks');

const eventsInsert = Promise.promisify(Calendar.events.insert);
const eventsUpdate = Promise.promisify(Calendar.events.update);
const eventsDelete = Promise.promisify(Calendar.events.delete);


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
    required: false,
  },
  description:  {
    type:                     DataTypes.STRING,
    required: false,
  },
  googleEventId: {
    type:                     DataTypes.STRING,
    required: false,
  },
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

Event.prototype.googleSerialize = function() {
  const {eventable} = this;

  // TODO: make this more generic and not only useful for Renting
  return models.Renting.scope(`eventable${eventable}`)
    .findById(this.EventableId)
    .then((eventableInstance) =>
      eventableInstance.googleSerialize(this)
    )
    .then(({calendarId, resource}) => ({
      auth: jwtClient,
      eventId : this.googleEventId,
      calendarId,
      resource: Object.assign({
        summary: this.summary,
        start: { dateTime: this.startDate },
        end: { dateTime: this.endDate },
        description: this.description,
      }, resource),
    }));
};

Event.prototype.googleCreate = function(options) {
  return this
    .googleSerialize(options)
    .then((serialized) => eventsInsert(serialized))
    .tap((googleEvent) => {
      return this
        .set('googleEventId', googleEvent.id)
        .save(Object.assign({}, options, {hooks: false}));
    });
};

Event.prototype.googleUpdate = function() {
  return this
    .googleSerialize()
    .then((serialized) => {
      return eventsUpdate(serialized);
    });
};

Event.prototype.googleDelete = function() {
  return this
    .googleSerialize()
    .then((serialized) => {
      return eventsDelete(serialized);
    })
    .then(() => {
      return this.set('googleEventId', null)
        .save({hook: false});
    });
};

Event.collection = collection;
Event.routes = (app) => {
  Utils.addRestoreAndDestroyRoutes(app, Event);
};
Event.hooks = hooks;

module.exports = Event;
