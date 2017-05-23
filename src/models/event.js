const Calendar              = require('googleapis').calendar('v3');
const Promise               = require('bluebird');
const {TRASH_SCOPES}        = require('../const');
const jwtClient             = require('../vendor/googlecalendar');

const eventsInsert = Promise.promisify(Calendar.events.insert);
const eventsUpdate = Promise.promisify(Calendar.events.update);

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
  const Event = sequelize.define('Event', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    summary: {
      type:                     DataTypes.STRING,
      required: true,
    },
    startDate: {
      type:                     DataTypes.DATE,
      required: true,
    },
    endDate: {
      type:                     DataTypes.DATE,
      required: false,
    },
    description:  {
      type:                     DataTypes.STRING,
      required: false,
    },
    googleEventId: {
      type:                     DataTypes.STRING,
      required: true,
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

    Event.addScope('client+apartment', {
      include:[{
        model: models.Renting,
        as: 'Renting',
        include: [{
          model: models.Room,
          include: [{
            model: models.Apartment,
          }],
        }, {
          model: models.Client,
        }],
      }],
    });

    Event.addScope('event-terms', {
      include: [{
        model: models.Term,
      }],
    });
  };

  Event.prototype.googleSerialize = function() {
    const {eventable} = this;

    return models[eventable].scope(`eventable${eventable}`)
      .findById(this.EventableId)
      .then((eventableItem) => {
        return eventableItem.googleSerialize(this);
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

//     return Utils
//       .getCheckinoutDuration(this.startDate, this.type)
//       .then((endDate) => {
//         return {
//           auth: jwtClient,
//           eventId : this.googleEventId,
//           calendarId: GOOGLE_CALENDAR_IDS[Apartment.addressCity],
//           resource: {
//             location: `${Apartment.addressStreet}
// , ${Apartment.addressZip} ${Apartment.addressCity},
// ${Apartment.addressCountry}`,
//             summary: `${this.type} ${Client.firstName} ${Client.lastName}`,
//             start: { dateTime: this.startDate },
//             end: { dateTime: endDate },
//             description: this.description,
//           },
//         };
//     });

  Event.prototype.googleCreate = function() {
    return this
      .googleSerialize()
      .then((serialized) => {
        return eventsInsert(serialized);
      })
      .tap((googleEvent) => {
        return this
          .set('googleEventId', googleEvent.id)
          .save({hooks: false});
      });
  };

  Event.prototype.googleUpdate = function () {
    return this
      .googleSerialize()
      .then((serialized) => {
        return eventsUpdate(serialized);
      })
      .tap((googleEvent) => {
        return this
          .set('googleEventId', googleEvent.id)
          .save({hooks: false});
      });
  };

  Event.hook('afterCreate', (event) => {
    console.log(event.id);
    return Event.scope('client+apartment')
      .findById(event.id)
      .then((result) => {
      console.log(result);
        return result.googleCreate();
      });
  });

  Event.hook('afterUpdate', (event) => {
    if ( event.googleEventId == null ) {
      return true;
    }

    return Event.scope('client+apartment')
      .findById(event.id)
      .then((result) => {
        return result.googleUpdate();
      });
  });

  return Event;
};
