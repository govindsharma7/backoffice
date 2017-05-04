const D     = require('date-fns');
const Liana = require('forest-express-sequelize');

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

  Renting.findCity = (roomId) => {
    return sequelize.models.Room
      .findAll({
        where: {
          '$Room.id$': roomId,
        },
        include: [{
          model: sequelize.models.Apartment,
        }],
      })
      .then((result) =>{
        return result[0].Apartment;
      })
      .catch((err) => {
        console.error(err);
    });
  };

  Renting.beforeLianaInit = (models, app) => {
    app.post('/forest/actions/housing-pack', Liana.ensureAuthenticated, (req,res) =>{
      var comfortLevel = req.body.data.attributes.values.comfortLevel;

      Renting
        .findById(req.body.data.attributes.ids[0])
        .then((renting) =>{
          return Promise.all([Renting.findCity(renting.RoomId), renting]);
        })
        .then(([apartment, renting]) => {
          return models.Order
            .create({
              type: 'invoice',
              label: 'Housing Pack',
              ClientId: renting.ClientId,
              OrderItems:[{
                label: `Housing Pack ${apartment.addressCity} ${comfortLevel}`,
                unitPrice: req.body.data.attributes.values.price ?  req.body.data.attributes.values.price : '460',
                RentingId: renting.id,
                ProductId: 'pack',
              }],
            },{
            include: [models.OrderItem],
            });
        })
        .then(() => {
          res.status(200).send({success: 'Housing pack ok'});
          return true;
        })
        .catch((err) =>{
          console.error(err);
          res.status(400).send({error: 'Housing pack not created'});
        });
    });
  };

  return Renting;
};
