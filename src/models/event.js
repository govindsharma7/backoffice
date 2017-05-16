const {TRASH_SCOPES} = require('../const');
//const config  = require('../config');
//const jwtClient = require('../vendor/googlecalendar');
//const calendar = require('googleapis').calendar('v3');

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
    calendarId: {
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
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });

  Event.associate = () => {
    Event.belongsTo(models.Renting, {
    foreignKey: 'eventableId',
    constraints: false,
    as: 'renting',
  });
  };


  Event.prototype.getItem = function() {
  return this['get' + this.get('eventable').substr(0, 1).toUpperCase()
              + this.get('eventable').substr(1)]();
  };

//
//  Event.afterUpdate = (event) => {
//    console.log('AFTERUPDATE');
//    event.getItem()
//    .then((result) => {
//      console.log(result);
//      return true;
//    })
//    .catch((err) =>{
//      console.log(err);
//    });
//  };
//
  Event.afterCreate = (event) => {
      console.log(event);
    event.getRenting()
    .then((result) => {
      console.log(result);
      return true;
    })
    .catch((err) => {
      console.log(err);
    });

  };
////    calendar.events.insert({
//      auth: jwtClient,
//      calendarId: config.GOOGLE_CALENDAR_ID,
//      resource:
//    }, (err, event) => {
//
//    })
//
//  Event.hook('afterCreate', Event.afterCreate);
//  Event.hook('afterUpdate', Event.afterUpdate);
//

  return Event;

};
