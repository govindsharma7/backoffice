const Liana             = require('forest-express-sequelize');
const Promise           = require('bluebird');
const Chromeless        = require('../../vendor/chromeless');
const makePublic        = require('../../middlewares/makePublic');
const checkToken        = require('../../middlewares/checkToken');
const Utils             = require('../../utils');
const {
  destroySuccessHandler,
}                       = require('../../utils/destroyAndRestoreSuccessHandler');

const Serializer  = Liana.ResourceSerializer;

module.exports = (app, models, Order) => {
  const LEA = Liana.ensureAuthenticated;
  const rInvoiceUrl = /https:\/\/payment\.chez-nestor\.com\/invoices\/(\d+)/;

  // Make this route completely public
  app.get('/forest/Order/:orderId', makePublic);

  // TODO: find out why, when throwing in that route, we get an
  // "cannot send headers" error in the console, and no error displayed in
  // Forest
  app.delete('/forest/Order/:orderId', LEA, (req, res) => {
    Order
      .findById(req.params.orderId)
      .then((order) => {
        return Promise.all([
          order,
          order.getCalculatedProps(),
        ]);
      })
      .then(([order, {totalPaid}]) => {
        if (totalPaid != null) {
          throw new Error('This order is partially/fully paid');
        }
        return order.destroy();
      })
      .then(destroySuccessHandler(res, 'Order'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/generate-invoice', LEA, (req, res) => {
    Order
      .findAll(
        { where: { id: { $in: req.body.data.attributes.ids } },
      })
      .then((orders) => {
        return Order.ninjaCreateInvoices(orders);
      })
      .then(Utils.createSuccessHandler(res, 'Ninja invoice'))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/actions/pdf-invoice/:filename', makePublic, (req, res) => {
    const { lang, orderId } = req.params;

    return Chromeless
      .invoiceAsPdf(orderId, lang)
      .then((pdf) => {
        return res.redirect(pdf);
      });
  });

  app.post('/forest/actions/payment-notification', checkToken, (req, res) => {
    const ninjaId = rInvoiceUrl.exec(req.body.message);

    if ( !ninjaId || !ninjaId[1] ) {
      return res.status(502).send('Invalid request');
    }

    return Order.scope('packItems')
      .findOne({ where: {ninjaId : ninjaId[1]} })
      .then((order) => {
        if ( !order ) {
          throw new Error(`No order found for the NinjaId ${ninjaId[1]}`);
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

  Utils.addRestoreAndDestroyRoutes(app, Order);
};
