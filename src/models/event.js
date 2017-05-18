const calendar        = require('googleapis').calendar('v3');
const Promise         = require('bluebird');

const Utils           = require('../utils');
const {TRASH_SCOPES}  = require('../const');
const config          = require('../config');
const jwtClient       = require('../vendor/googlecalendar');

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
    },
    endDate: {
      type:                     DataTypes.DATE,
      required: false,
    },
    description:  {
      type:                     DataTypes.STRING,
      required: false,
    },
    type: {
      type:                     DataTypes.ENUM('checkin', 'checkout'),
      required: true,
    },
    googleEventId: {
      type:                     DataTypes.STRING,
      required: true,
    },
    eventable: {
      type:                     DataTypes.STRING,
      required: true,
    },
    eventableId: {
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
      foreignKey: 'eventableId',
      constraints: false,
      as: 'Renting',
    });
    Event.addScope('roomApartment', {
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
  };


  Event.prototype.getItem = function() {
  return this['get' + this.get('eventable').substr(0, 1).toUpperCase()
             + this.get('eventable').substr(1)]();
  };

  Event.prototype.googleSerialize = function() {
    const {Apartment} = this.Renting.Room;
    const {Client} = this.Renting;

    return Utils.getCheckinoutDuration(this.startDate, this.type)
      .then((endDate) => {
        return {
          auth: jwtClient,
          eventId : this.googleEventId,
          calendarId: config.GOOGLE_CALENDAR_IDS[Apartment.addressCity],
          resource: {
            location: `${Apartment.addressStreet}
, ${Apartment.addressZip} ${Apartment.addressCity},
${Apartment.addressCountry}`,
            summary: `${this.type} ${Client.firstName} ${Client.lastName}`,
            start: {
              dateTime: this.startDate,
            },
            end: {
              dateTime: endDate,
            },
            description: this.description,
          },
        };
    });
  };

  Event.prototype.createCalendarEvent = function() {
    /* eslint-disable promise/avoid-new */
    return new Promise((resolve, reject) => {
    /* eslint-enable promise/avoid-new */
      this.googleSerialize()
        .then((googleEvent) => {
          return calendar.events.insert(
            googleEvent,
            (err, calendarEvent) => {
              if ( err ) {
                return reject(err);
              }
              this
              .set('googleEventId', calendarEvent.id)
              .save({hooks: false});
              return resolve(calendarEvent);
            });
        })
        .catch((err) =>{
          console.error(err);
        });
    });
  };

  Event.prototype.updateCalendarEvent = function () {
    /* eslint-disable promise/avoid-new */
    return new Promise((resolve, reject) => {
    /* eslint-enable promise/avoid-new */
      this.googleSerialize()
        .then((googleEvent) =>{
          return calendar.events.update(
            googleEvent,
            (err, calendarEvent) => {
              if ( err ) {
                return reject(err);
              }
              return resolve(calendarEvent);
            });
        })
        .catch((err) =>{
          console.error(err);
        });
    });
  };

  Event.afterCreate = function(event) {
    if ( event.id ) {
      Event
        .scope('roomApartment')
        .findById(event.id)
        .then((result) => {
          return result.createCalendarEvent();
        })
        .catch((err) => {
          console.error(err);
        });
    }

    return true;
  };

  Event.afterUpdate = function(event) {
    if ( event.googleEventId ) {
      Event
        .scope('roomApartment')
        .findById(event.id)
        .then((result) => {
          return result.updateCalendarEvent();
        })
        .catch((err) => {
          console.error(err);
        });
    }

    return true;
  };

  Event.hook('afterCreate', Event.afterCreate);
  Event.hook('afterUpdate', Event.afterUpdate);

  return Event;

};
