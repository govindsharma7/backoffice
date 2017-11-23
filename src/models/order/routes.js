const Liana             = require('forest-express-sequelize');
const Promise           = require('bluebird');
const Chromeless        = require('../../vendor/chromeless');
const Sendinblue        = require('../../vendor/sendinblue');
const makePublic        = require('../../middlewares/makePublic');
const Utils             = require('../../utils');

const Serializer  = Liana.ResourceSerializer;

module.exports = (app, models, Order) => {
  const LEA = Liana.ensureAuthenticated;

  // Make this route completely public
  app.get('/forest/Order/:orderId', makePublic);

  app.get('/forest/Invoice/:orderId', makePublic, (req, res) =>
    Order.scope('invoice')
      .findById(req.params.orderId)
      .then((order) => Promise.all([
        order.toJSON(),
        order.getCalculatedProps(),
      ]))
      .then(([order, calculatedProps]) => res.send(Object.assign(
        order,
        calculatedProps
      )))
      .catch(Utils.logAndSend(res))
  );

  app.get('/forest/actions/pdf-invoice/:filename', makePublic, (req, res) => {
    const { lang, orderId } = req.query;
    const { filename } = req.params;

    return Chromeless
      .invoiceAsPdf(orderId, lang)
      .then((pdf) =>
        res
          .set('Content-Disposition', `filename=${filename}`)
          .redirect(pdf)
      );
  });

  app.post('/forest/actions/send-payment-request', LEA, (req, res) =>
    Order.findAll({
        where: { id: { $in: req.body.data.attributes.ids } },
        include: [{ model: models.Client }, { model: models.OrderItem }],
      })
      .map((order) => Promise.all([
        { order, client: order.Client },
        order.getCalculatedProps(),
      ]))
      .map(([{ order, client }, { amount, balance }]) =>
        order.sendPaymentRequest({ client, amount, balance })
      )
      .then(Utils.sentSuccessHandler(res, 'Payment Request'))
      .catch(Utils.logAndSend(res))
  );

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

  app.get('/forest/Order/:orderId/relationships/Refunds', LEA, (req, res) =>
    models.Credit
      .findAll({
        where: { '$Payment.OrderId$': req.params.orderId },
        include: [{ model: models.Payment }],
      })
      .then((credits) => new Serializer(Liana, models.Credit, credits, {}, {
        count: credits.length,
      }).perform())
      .then((result) => res.send(result))
      .catch(Utils.logAndSend(res))
  );

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
      .tap((order) => order.destroyOrCancel())
      .then(Utils.createdSuccessHandler(res, 'Cancel invoice'))
      .catch(Utils.logAndSend(res));
  });
};
