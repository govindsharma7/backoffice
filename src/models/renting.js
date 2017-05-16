const Promise        = require('bluebird');
const D              = require('date-fns');
const Liana          = require('forest-express-sequelize');
const Utils          = require('../utils');
const {TRASH_SCOPES} = require('../const');

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
  const Renting = sequelize.define('Renting', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    bookingDate: {
      type:                     DataTypes.DATE,
      required: true,
    },
    expectedCheckoutDate:  {
      type:                     DataTypes.DATE,
      required: true,
    },
    price: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    serviceFees: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });

  Renting.associate = () => {
    Renting.belongsTo(models.Client);
    Renting.belongsTo(models.Room);
    Renting.hasMany(models.OrderItem);

    Renting.hasMany(models.Event, {
    foreignKey: 'eventableId',
    constraints: false,
    scope: {
      eventable: 'renting',
      },
    });
    Renting.addScope('room-apartment', {
      include: [{
        model: models.Room,
        attributes: ['reference'],
        include: [{
          model: models.Apartment,
          attributes: ['reference', 'addressCity', 'addressStreet'],
        }],
      }],
    });
    Renting.addScope('event', {
      include: [{
        model: models.Event,
        where: {
          type: 'checkin',
        },
        required: false,
      }],
    });
  };

  // Prorate the price and service fees of a renting for a given month
  Renting.prototype.prorate = function(date) {
    const daysInMonth = D.getDaysInMonth(date);
    const startOfMonth = D.startOfMonth(date);
    const endOfMonth = D.endOfMonth(date);
    var daysStayed = daysInMonth;

    if (
      this.bookingDate > endOfMonth ||
      ( this.checkoutDate != null && this.checkoutDate < startOfMonth )
    ) {
      daysStayed = 0;
    }
    else {
      if ( this.bookingDate > startOfMonth ) {
        daysStayed -= D.getDate(this.bookingDate);
      }
      if ( this.checkoutDate != null && this.checkoutDate < endOfMonth ) {
        daysStayed -= daysInMonth - D.getDate(this.checkoutDate);
      }
    }

    return {
      price: Utils.euroRound(( this.price / daysInMonth ) * daysStayed),
      serviceFees: Utils.euroRound(( this.serviceFees / daysInMonth ) * daysStayed),
    };
  };

  Renting.prototype.toOrderItems = function(date = Date.now()) {
    const prorated = this.prorate(date);
    const room = this.Room;
    const apartment = room.Apartment;
    const month = D.format(date, 'MMMM');

    return [{
      label: `${month} Rent - Room #${room.reference}`,
      unitPrice: prorated.price,
      RentingId: this.id,
      ProductId: 'rent',
    }, {
      label: `${month} Service Fees - Apt #${apartment.reference}`,
      unitPrice: prorated.serviceFees,
      RentingId: this.id,
      ProductId: 'service-fees',
    }];
  };

  Renting.prototype.createOrder = function(date = Date.now(), number) {
    const {Order, OrderItem} = models;

    return Order.create({
      type: 'debit',
      label: `${D.format(date, 'MMMM')} Invoice`,
      dueDate: Math.max(Date.now(), D.startOfMonth(this.bookingDate)),
      ClientId: this.ClientId,
      OrderItems: this.toOrderItems(date),
      number,
    }, {
      include: [OrderItem],
    });
  };

  Renting.prototype.createPackOrder = function({comfortLevel, discount}, number) {

    const {Order, OrderItem} = models;
    const {addressCity} = this.Room.Apartment;
    const {startDate} = this.Events[0];

    return Promise.all([
        Utils.getPackPrice(addressCity, comfortLevel),
        Utils.getCheckinPrice(startDate, comfortLevel),
      ])
      .then(([packPrice, checkinPrice]) => {
        const items = [{
          label: `Housing Pack ${addressCity} ${comfortLevel}`,
          unitPrice: packPrice,
          RentingId: this.id,
          ProductId: 'pack',
        }];

        if ( checkinPrice !== 0 ) {
          items.push({
            label: 'Special checkin',
            unitPrice: checkinPrice,
            ProductId: 'special-checkinout',
          });
        }

        if ( discount != null && discount !== 0 ) {
          items.push({
            label: 'Discount',
            unitPrice: -1 * discount,
            RentingId: this.id,
            ProductId: 'pack',
          });
        }

        return Order.create({
          type: 'debit',
          label: 'Housing Pack',
          dueDate: Math.max(Date.now(), D.startOfMonth(this.bookingDate)),
          ClientId: this.ClientId,
          OrderItems: items,
          number,
        }, {
          include: [OrderItem],
        });
      });
  };

  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees once!
    if ( renting.price != null ) {
      return renting;
    }

    return models.Room.scope('roomCount')
      .findById(renting.RoomId)
      .then((room) => {
        return room.getCalculatedProps(renting.bookingDate);
      })
      .then(({periodPrice, serviceFees}) => {
        renting.setDataValue('price', periodPrice);
        renting.setDataValue('serviceFees', serviceFees);
        return renting;
      });
  });

  Renting.prototype.addCheckoutDate = function({plannedDate}) {
    const {Event} = models;
    const {addressStreet}  = this.Room.Apartment;

    return Event
      .create({
        startDate: plannedDate,
        //a checkout average a time of 45 minutes
        endDate: D.addMinutes(plannedDate, 45),
        description: this.ClientId + ' ' + addressStreet,
        type: 'checkout',
        eventable: 'renting',
        eventableId: this.id,
      });
  };

  Renting.prototype.addCheckinDate = function({plannedDate}) {
    const {Event} = models;
    const {addressStreet}  = this.Room.Apartment;

    return Event
      .create({
        startDate: plannedDate,
        //a checkin average a time of 45 minutes
        endDate: D.addMinutes(plannedDate, 45),
        description: this.ClientId + ' ' + addressStreet,
        type: 'checkin',
        eventable: 'renting',
        eventableId: this.id,
      });
  };

  Renting.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/create-rent-order', LEA, (req, res) => {
      const {ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if ( ids.length > 1 ) {
            throw new Error('Can\'t create multiple rent orders');
          }

          return Renting.scope('room-apartment').findById(ids[0]);
        })
        .then((renting) => {
          return renting.createOrder();
        })
        .then(() => {
          return res.status(200).send({success: 'Renting Order Created'});
        })
        .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/create-pack-order', LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      if ( values.discount != null ) {
        values.discount *= 100;
      }

      Promise.resolve()
        .then(() => {
          if ( !values.comfortLevel ) {
            throw new Error('Please select a comfort level');
          }
          if ( ids.length > 1 ) {
            throw new Error('Can\'t create multiple housing-pack orders');
          }

          return Renting.scope('room-apartment', 'event').findById(ids[0]);
        })
        .then((renting) => {
          console.log(renting);
          if ( !renting.Events.length ) {
            throw new Error('Checkin date is required to create the housing-pack order');
          }

          return renting.createPackOrder(values);
        })
        .then(() => {
          return res.status(200).send({success: 'Housing Pack created'});
        })
        .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/add-checkout-date', LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      if ( !values.plannedDate ) {
        return res.status(400).send({error:'Please select a planned date'});
      }
      if ( ids.length > 1 ) {
        return res.status(400).send({error:'Can\'t create multiple checkout events'});
      }

      Renting
        .scope('room-apartment').findById(ids[0])
        .then((renting) => {
//          console.log(renting);
          return renting.addCheckoutDate(values);
        })
        .then(() => {
          return res.status(200).send({success: 'Checkout event created'});
        })
        .catch((err) => {
          console.error(err);
          res.status(400).send({error: err.message});
        });
      return null;
    });

    app.post('/forest/actions/add-checkin-date', LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      if ( !values.plannedDate ) {
        return res.status(400).send({error:'Please select a planned date'});
      }
      if ( ids.length > 1 ) {
        return res.status(400).send({error:'Can\'t create multiple checkin events'});
      }

      Renting
        .scope('room-apartment').findById(ids[0])
        .then((renting) => {
//          console.log(renting);
          return renting.addCheckinDate(values);
        })
        .then(() => {
          return res.status(200).send({success: 'Checkin event created'});
        })
        .catch((err) => {
          console.error(err);
          res.status(400).send({error: err.message});
        });
      return null;
    });
  };

  return Renting;
};
