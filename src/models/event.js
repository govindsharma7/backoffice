const Calendar              = require('googleapis').calendar('v3');
const Promise               = require('bluebird');
const capitalize            = require('lodash/capitalize');

const {TRASH_SCOPES}        = require('../const');
const jwtClient             = require('../vendor/googlecalendar');
const Utils                 = require('../utils');

const eventsInsert = Promise.promisify(Calendar.events.insert);
const eventsUpdate = Promise.promisify(Calendar.events.update);
const eventsDelete = Promise.promisify(Calendar.events.delete);

const _ = { capitalize };



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
    Event.belongsTo(models.Client, {
      foreignKey: 'EventableId',
      constaints: false,
      as: 'Client',
    });

    Event.addScope('event-category', {
      attributes: { include: [
        [sequelize.col('Terms.name'), 'category'],
      ]},
      include: [{
        model: models.Term,
        required: false,
        where: { taxonomy: 'event-category' },
      }],
    });
  };

  Event.prototype.googleSerialize = function() {
    const {eventable} = this;

    return models[eventable].scope(`eventable${eventable}`)
      .findById(this.EventableId)
      .then((eventableInstance) => {
        return eventableInstance.googleSerialize(this);
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

  Event.prototype.googleCreate = function(transaction) {
    return this
      .googleSerialize(transaction)
      .then((serialized) => {
        return eventsInsert(serialized);
      })
      .tap((googleEvent) => {
        return this.update({googleEventId: googleEvent.id}, Object.assign(
          {},
          {transaction},
          {hooks: false}
        ));
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
          .save({hooks: false});
      });
  };

  function wrapHookHandler(event, transaction, callback) {
    /* eslint-disable promise/no-callback-in-promise */
    return Event.scope('event-category')
      .findById(event.id, {transaction})
      .then(callback)
      .thenReturn(true)
      .tapCatch(console.error);
    /* eslint-enable promise/no-callback-in-promise */
  }

  Event.hook('afterCreate', (event, options) => {
    const {transaction} = options;

    return wrapHookHandler(event, transaction, (event) => {
      return event.googleCreate(transaction);
    });
  });

  Event.hook('afterUpdate', (event, options) => {
    const {transaction} = options;
    const {eventable, EventableId} = event;

    return wrapHookHandler(event, transaction, (event) => {
      if (event.get('category') !== 'refund-deposit' ) {
        return Utils[`get${_.capitalize(event.get('category'))}EndDate`](
          event.startDate)
        .then((endDate) => {
          return event.update({endDate}, {hooks: false});
        })
        .then(() => {
          return models[eventable].handleEventUpdate &&
            models[eventable].handleEventUpdate(event, EventableId, transaction);
        })
        .then(() => {
          return event.googleEventId != null && event.googleUpdate();
        });
      }
      return event.update({endDate: event.startDate}, {hooks: false})
        .then(() => {
          return event.googleEventId != null && event.googleUpdate();
      });
    });
  });

  Event.hook('afterDelete', (event, options) => {
    if ( event.googleEventId != null ) {
      return wrapHookHandler(event, options, (event) => {
        return event.googleDelete();
      });
    }

    return true;
  });

  Event.hook('afterRestore', (event, options) => {
    if ( event.googleEventId != null ) {
      return wrapHookHandler(event, (event) => {
        return event.googleCreate(options);
      });
    }

    return true;
  });

  Event.beforeLianaInit = (app) => {
    Utils.addRestoreAndDestroyRoutes(app, Event);
  };

  return Event;
};
