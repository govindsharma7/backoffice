const Liana       = require('forest-express-sequelize');
const makePublic  = require('../../middlewares/makePublic');
const Utils       = require('../../utils');

const Serializer = Liana.ResourceSerializer;

module.exports = (app, models, Order) => {
  const LEA = Liana.ensureAuthenticated;

  // Make this route completely public
  app.get('/forest/Order/:orderId', makePublic);

  app.post('/forest/actions/generate-invoice', LEA, (req, res) => {
    Order
      .findAll({ where: { id: { $in: req.body.data.attributes.ids } } })
      .then((orders) => {
        return Order.ninjaCreateInvoices(orders);
      })
      .then(Utils.createSuccessHandler(res, 'Ninja invoices'))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Order/:orderId/relationships/Refunds', LEA, (req, res) => {
    models.Credit.scope('order')
      .findAll({ where: { '$Payment.OrderId$': req.params.orderId } })
      .then((credits) => {
        return new Serializer(Liana, models.Credit, credits, {}, {
          count: credits.length,
        }).perform();
      })
      .then((result) => {
        return res.send(result);
      })
      .catch(Utils.logAndSend(res));
  });

  Utils.addRestoreAndDestroyRoutes(app, Order);
};
