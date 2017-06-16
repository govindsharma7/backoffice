const Calendar              = require('googleapis').calendar('v3');
const Promise               = require('bluebird');
const {TRASH_SCOPES}        = require('../const');
const jwtClient             = require('../vendor/googlecalendar');
const Utils                 = require('../utils');

const eventsInsert = Promise.promisify(Calendar.events.insert);
const eventsUpdate = Promise.promisify(Calendar.events.update);
const eventsDelete = Promise.promisify(Calendar.events.delete);

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
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

  Event.associate = () => {
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
        model: models.Term,
        where: { taxonomy: 'event-category' },
      }],
    });
  };

  Event.prototype.googleSerialize = function(options) {
    const {eventable} = this;

    return Promise.all([
        models[eventable].scope(`eventable${eventable}`).findById(this.EventableId),
        Event.scope('event-category').findById(this.id, options),
      ])
      .then(([eventableInstance, event]) => {
        return eventableInstance.googleSerialize(event);
      })
      .then(({calendarId, resource}) => {
        return {
          auth: jwtClient,
          eventId : this.googleEventId,
          calendarId,
          resource: Object.assign({
            summary: this.summary,
            start: { dateTime: this.startDate },
            end: { dateTime: this.endDate },
            description: this.description,
          }, resource),
        };
      });
  };

  Event.prototype.googleCreate = function(options) {
    return this
      .googleSerialize(options)
      .then((serialized) => {
        return eventsInsert(serialized);
      })
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

  Event.hook('afterCreate', (event, options) => {
    return Utils.wrapHookPromise(event.googleCreate(options));
  });

  Event.hook('afterUpdate', (event) => {
    if ( event.googleEventId != null ) {
      return Utils.wrapHookPromise(event.googleUpdate());
    }

    return true;
  });

  Event.hook('afterDelete', (event) => {
    if ( event.googleEventId != null ) {
      return Utils.wrapHookPromise(event.googleDelete());
    }

    return true;
  });

  Event.hook('afterRestore', (event, options) => {
    return Utils.wrapHookPromise(event.googleCreate(options));
  });

  Event.beforeLianaInit = (app) => {
    Utils.restoreAndDestroyRoutes(app, Event);
  };

  return Event;
};
