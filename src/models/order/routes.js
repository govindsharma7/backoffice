const Liana             = require('forest-express-sequelize');
const Promise           = require('bluebird');
const Chromeless        = require('../../vendor/chromeless');
const Sendinblue        = require('../../vendor/sendinblue');
const makePublic        = require('../../middlewares/makePublic');
// const checkToken        = require('../../middlewares/checkToken');
const Utils             = require('../../utils');
// const {
//   destroySuccessHandler,
// }                       = require('../../utils/destroyAndRestoreSuccessHandler');

const Serializer  = Liana.ResourceSerializer;

module.exports = (app, models, Order) => {
  const LEA = Liana.ensureAuthenticated;
  // const rInvoiceUrl = /https:\/\/payment\.chez-nestor\.com\/invoices\/(\d+)/;

  // Make this route completely public
  app.get('/forest/Order/:orderId', makePublic);

  // app.post('/forest/actions/generate-invoice', LEA, (req, res) => {
  //   return Order
  //     .findAll({
  //       where: { id: { $in: req.body.data.attributes.ids } },
  //     })
  //     .then((orders) => {
  //       return Order.ninjaCreateInvoices(orders);
  //     })
  //     .then(Utils.createdSuccessHandler(res, 'Ninja invoice'))
  //     .catch(Utils.logAndSend(res));
  // });

  app.get('/forest/Invoice/:orderId', makePublic, (req, res) => {
    return Order.scope('invoice')
      .findById(req.params.orderId)
      .then((order) => {
        return Promise.all([
          order.toJSON(),
          order.getCalculatedProps(),
        ]);
      })
      .then(([order, calculatedProps]) => {
        return res.send(Object.assign(
          order,
          calculatedProps
        ));
      })
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/actions/pdf-invoice/:filename', makePublic, (req, res) => {
    const { lang, orderId } = req.query;
    const { filename } = req.params;

    return Chromeless
      .invoiceAsPdf(orderId, lang)
      .then((pdf) => {
        return res
          .set('Content-Disposition', `filename=${filename}`)
          .redirect(pdf);
      });
  });

  app.post('/forest/actions/send-payment-request', LEA, (req, res) => {
    const { ids } = req.body.data.attributes;

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t send multiple payment requests');
        }

        return Order.findOne({
          where: { id: ids[0] },
          include: [{ model: models.Client }, { model: models.OrderItem }],
        });
      })
      .then((order) => {
        return Promise.all([
          order,
          order.getCalculatedProps(),
        ]);
      })
      .then(([order, { amount, balance }]) => {
        const { OrderItems, Client } = order;

        if ( balance >= 0 ) {
          throw new Error('Can\'t send payment request, the balance is positive');
        }

        if ( OrderItems.some(({ ProductId }) => ProductId === 'rent' ) ) {
          return Sendinblue.sendRentRequest({ order, amount, client: Client });
        }

        if ( OrderItems.some(({ ProductId }) => /-pack$/.test(ProductId)) ) {
          return Sendinblue.sendHousingPackRequest({ order, amount, client: Client });
        }

        throw new Error('Payment request not implemented for this type of order');
      })
      .then(Utils.sentSuccessHandler(res, 'Payment Request'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/send-housing-pack-request', LEA, (req, res) => {
    const { ids } = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t send multiple Housing Pack request');
        }

        // The order of these scopes matters!
        return Order.scope('amount')
          .findById(ids[0], { include: [{ model: models.Client }] });
      })
      .then((order) => {
        if ( !order ) {
          throw new Error('This isn\'t a Housing Pack Order');
        }

        return Sendinblue.sendHousingPackRequest({
          order, amount: order.get('amount'),
          client: order.Client,
        });
      })
      .then(Utils.sendSuccessHandler(res, 'Housing Pack Request'))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Order/:orderId/relationships/Refunds', LEA, (req, res) => {
    return models.Credit
      .findAll({
        where: { '$Payment.OrderId$': req.params.orderId },
        include: [{ model: models.Payment }],
      })
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

  app.post('/forest/actions/cancel-order', LEA, (req, res) => {
    const {ids} = req.body.data.attributes;

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t cancel multiple orders');
        }

        return Order.findOne({
          where: { id: ids[0] },
          include: [
            { model: models.OrderItem },
            { model: models.Payment },
          ],
        });
      })
      .tap((order) => {
        return Order.destroyOrCancel(order);
      })
      .then(Utils.createdSuccessHandler(res, 'Cancel invoice'))
      .catch(Utils.logAndSend(res));
  });
};
