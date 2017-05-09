const D                = require('date-fns');
const Liana            = require('forest-express-sequelize');

const PACK_PRICES = {
  lyon: {
    basique: 59000,
    confort: 79000,
    privilege: 99000,
  },
  montpellier: {
    basique: 39000,
    confort: 59000,
    privilege: 79000,
  },
  paris: {
    basique: 79000,
    confort: 99000,
    privilege: 119000,
  },
};

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
    const {Order, OrderItem} = sequelize.models;

    return Order.create({
      type: 'debit',
      label: `${D.format('MMMM')} Invoice`,
      dueDate: Math.max(Date.now(), D.startOfMonth(this.checkinDate)),
      ClientId: this.ClientId,
      OrderItems: this.toOrderItems(),
      number,
    }, {
      include: [OrderItem],
    });
  };

  Renting.prototype.createPackOrder = function({comfortLevel, price}, number) {
    const {Order, OrderItem} = sequelize.models;
    const {addressCity} = this.Room.Apartment;

    return Order.create({
      type: 'debit',
      label: 'Housing Pack',
      dueDate: Math.max(Date.now(), D.startOfMonth(this.checkinDate)),
      ClientId: this.ClientId,
      OrderItems:[{
        label: `Housing Pack ${addressCity} ${comfortLevel}`,
        unitPrice: PACK_PRICES[addressCity][comfortLevel],
        RentingId: this.id,
        ProductId: 'pack',
      }],
      number,
    }, {
      include: [OrderItem],
    });
  };

  Renting.beforeLianaInit = (models, app) => {
    const {ROOM_APARTMENT} = sequelize.includes;

    app.post('/forest/actions/create-order', Liana.ensureAuthenticated, (req, res) => {
      const {ids} = req.body.data.attributes;

      if ( ids.length > 1 ) {
        return res.status(400).send({error:'Can\'t create multiple orders'});
      }

      return Renting
        .findById(ids[0], {
          include: ROOM_APARTMENT,
        })
        .then((renting) => {
          return renting.createOrder();
        })
        .then(() => {
          return res.status(200).send({success: 'Renting Order Created'});
        })
        .catch((err) =>{
          console.error(err);
          res.status(400).send({error: err.message});
        });
    });

    app.post('/forest/actions/housing-pack', Liana.ensureAuthenticated, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      if ( !values.comfortLevel ) {
        return res.status(400).send({error:'Please select a comfort level'});
      }
      if ( ids.length > 1 ) {
        return res.status(400).send({error:'Can\'t create multiple house packs'});
      }
      return Renting
        .findById(ids[0], {
          include: ROOM_APARTMENT,
        })
        .then((renting) => {
          return renting.createPackOrder(values);
        })
        .then(() => {
          return res.status(200).send({success: 'Housing Pack created'});
        })
        .catch((err) =>{
          console.error(err);
          res.status(400).send({error: err.message});
        });
    });
  };

  return Renting;
};
