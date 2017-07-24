const Liana       = require('forest-express-sequelize');
const Promise     = require('bluebird');
const makePublic  = require('../../middlewares/makePublic');
const Utils       = require('../../utils');

const Serializer  = Liana.ResourceSerializer;

module.exports = (app, models, Order) => {
  const LEA = Liana.ensureAuthenticated;

  // Make this route completely public
  app.get('/forest/Order/:orderId', makePublic);

  app.post('/forest/actions/generate-invoice', LEA, (req, res) => {
    Order
      .findAll(
        { where: { id: { $in: req.body.data.attributes.ids } },
        // include draft orders
//        paranoid: false,
      })
      .then((orders) => {
        return Order.ninjaCreateInvoices(orders);
      })
      .then(Utils.createSuccessHandler(res, 'Ninja invoice'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/payment-notification', (req, res) => {
    const ninjaId =
      /https:\/\/payment\.chez-nestor\.com\/invoices\/(\d+)/.exec(req.message);

    if ( !ninjaId || !ninjaId[1] ) {
      res.status(502).send('Invalid request');
    }

    Order.scope('packItems')
      .findOne({ where: {ninjaId : ninjaId[1]} })
      .then((order) => {
        if ( !order ) {
          throw new Error('No order found for this NinjaId');
        }

        return order.markAsPaid();
      })
      .then(Utils.createSuccessHandler(res, 'Payment Notification'))
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

  app.post('/forest/actions/cancel-invoice', LEA, (req, res) => {
    const {ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t cancel multiple orders');
        }
        return Order.scope('orderItems')
          .findById(ids[0]);
      })
      .then((order) => {
        if ( !order.receiptNumber ) {
          throw new Error('This order is a draft and should be deleted instead.');
        }
        if ( order.type !== 'debit' ) {
          throw new Error(`Only debit orders can be cancelled (found ${order.type})`);
        }
        return order.findOrCreateCancelOrder();
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Cancel invoice'))
      .catch(Utils.logAndSend(res));
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Order,
    associatedModel: models.OrderItem,
    routeName: 'OrderItems',
    scope: 'untrashed',
    where: (req) => {
      return { OrderId: req.params.recordId };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Order);
};
