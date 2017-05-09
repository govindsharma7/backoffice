const Promise          = require('bluebird');
const Liana            = require('forest-express-sequelize');

module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    label: {
      type:                     DataTypes.STRING,
      required:                 true,
    },
    quantity: {
      type:                     DataTypes.FLOAT, // can be a fraction
      defaultValue: 1,
      required: false,
    },
    unitPrice: {
      type:                     DataTypes.INTEGER,
      required: false,
    },
    vatRate: {
      type:                     DataTypes.ENUM('0', '0.2'),
      required: true,
      defaultValue: '0',
      get: function() {
        return parseFloat(this.getDataValue('vatRate'));
      },
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active', 'archived'),
      required: true,
      defaultValue: 'active',
    },
  });
  const {models} = sequelize;

  OrderItem.associate = () => {
    OrderItem.belongsTo(models.Order);
    OrderItem.belongsTo(models.Renting, {
      constraints: false,
    });
    OrderItem.belongsTo(models.Product, {
      constraints: false,
    });
  };

  OrderItem.prototype.getAmount = function() {
    return Promise.resolve(
        this.unitPrice * this.quantity * ( 1 + this.vatRate )
    );
  };

  OrderItem.prototype.ninjaSerialize = function() {
    return Promise.resolve({
      'product_key': this.label,
      'cost': this.unitPrice / 100,
      'qty': this.quantity,
    });
  };

  OrderItem.beforeFind = (query) => {
    if (!('id' in query.where) && !('status' in query.where)) {
      if (query.where.$and) {
        const verif = query.where.$and.some((element) => {
          if (element.$and) {
            return element.$and.some((secondElement) => {
              return element.id ||
                element.status ||
                secondElement.id ||
                secondElement.status;
            });
          }
          return element.id || element.status;
        });

        if (!verif) {
          query.where.status = 'active';
        }
      }
      else {
        query.where.status = 'active';
      }
    }
  };

  OrderItem.hook('beforeFind', OrderItem.beforeFind);

  // Run Order's afterUpdate hook when an orderItem is updated
  OrderItem.hook('afterUpdate', (orderItem) => {
    return orderItem
      .getOrder()
      .then(models.Order.afterUpdate);
  });

  OrderItem.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/add-discount', LEA, (req, res) => {
      const {ids, values} = req.body.data.attributes;

      if ( ids.length > 1 ) {
        return res.status(400).send({error:'Can\'t create multiple discounts'});
      }

      OrderItem
        .findById(ids[0])
        .then((orderItem) => {
          return OrderItem.create({
            label: 'Discount',
            unitPrice: -100 * values.amount,
            RentingId: orderItem.RentingId,
            ProductId: 'rent',
          });
        })
        .then(() => {
          return res.status(200).send({success: 'Discount created'});
        })
        .catch((err) =>{
          console.error(err);
          res.status(400).send({error: err.message});
        });

      return null;
    });
  };

  return OrderItem;
};
