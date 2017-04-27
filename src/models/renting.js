const D = require('date-fns');

module.exports = (sequelize, DataTypes) => {
  const Renting = sequelize.define('Renting', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    checkinDate: {
      type:                     DataTypes.DATE,
      required: true,
    },
    checkoutDate:  {
      type:                     DataTypes.DATE,
      required: false,
    },
    price: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    serviceFees: {
      type:                     DataTypes.INTEGER,
      required: true,
      defaultValue: 30,
    },
  });

  Renting.associate = () => {
    const {models} = sequelize;

    Renting.belongsTo(models.Client);
    Renting.belongsTo(models.Room);
    Renting.hasMany(models.OrderItem);
  };

  // Prorate the price and service fees of a renting for a given month
  Renting.prototype.prorate = function(date) {
    const daysInMonth = D.getDaysInMonth(date);
    const startOfMonth = D.startOfMonth(date);
    const endOfMonth = D.endOfMonth(date);
    var daysStayed = daysInMonth;

    if ( this.checkinDate > endOfMonth || this.checkoutDate < startOfMonth ) {
      daysStayed = 0;
    }
    else {
      if ( this.checkinDate > startOfMonth ) {
        daysStayed -= D.getDate(this.checkinDate);
      }
      if ( this.checkoutDate < endOfMonth ) {
        daysStayed -= daysInMonth - D.getDate(this.checkoutDate);
      }
    }

    return {
      price: Math.round(( this.price / daysInMonth ) * daysStayed),
      serviceFees: Math.round(( this.serviceFees / daysInMonth ) * daysStayed),
    };
  };

  return Renting;
};
