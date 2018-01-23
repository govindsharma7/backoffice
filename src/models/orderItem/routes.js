const Liana       = require('forest-express-sequelize');
const { wrap }    = require('express-promise-wrap');
const makePublic  = require('../../middlewares/makePublic');
const Utils       = require('../../utils');

module.exports = function(app, { OrderItem }) {
  const LEA = Liana.ensureAuthenticated;

  // Make retrieving OrderItems and associated Orders by OrderId or rentingId
  // public
  app.get('/forest/OrderItem', (req, res, next) =>
    (
      req.query.filterType === 'and' &&
      /(Renting|Order)Id/.test(Object.keys(req.query.filter).join(''))
    ) ?
      makePublic(req, res, next) :
      LEA(req, res, next)
  );

  app.post('/forest/actions/add-discount', LEA, wrap(async (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple discounts');
    }

    const orderItem = await OrderItem.findById(ids[0]);

    await orderItem.createDiscount(100 * values.discount);

    res.status(200).send({success: 'Discount created'});
  }));

  Utils.addRestoreAndDestroyRoutes(app, OrderItem);
};
