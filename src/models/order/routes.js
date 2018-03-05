const kebabCase           = require('lodash/kebabCase');
const Liana               = require('forest-express-sequelize');
const { wrap }            = require('express-promise-wrap');
const Promise             = require('bluebird');
const Op                  = require('../../operators');
const { REST_API_URL }    = require('../../config');
const Chromeless          = require('../../vendor/chromeless');
const makePublic          = require('../../middlewares/makePublic');
const Utils               = require('../../utils');

const Serializer  = Liana.ResourceSerializer;
const _ = { kebabCase };

module.exports = (app, { Order, Client, OrderItem, Credit, Payment }) => {
  const LEA = Liana.ensureAuthenticated;

  // Make this route completely public
  app.get('/forest/Order/:orderId', makePublic);

  app.get('/forest/Invoice/:orderId', makePublic, wrap(async (req, res) => {
    const order = await Order.scope('invoice').findById(req.params.orderId);
    const [json, calculatedProps] = await Promise.all([
      order.toJSON(),
      order.getCalculatedProps(),
    ]);

    res.send(Object.assign( json, calculatedProps ));
  }));

  app.get('/forest/actions/pdf-invoice/:filename', makePublic, wrap(async (req, res) => {
    const { lang, orderId } = req.query;
    const { filename } = req.params;
    const pdf = await Chromeless.invoiceAsPdf(orderId, lang);

    res
      .set('Content-Disposition', `filename=${filename}`)
      .redirect(pdf);
  }));

  app.post('/forest/actions/generate-invoice', wrap(async (req, res) => {
    const orders = await Order.findAll({
      where: { id: { [Op.in]: req.body.data.attributes.ids } },
    });

    await Promise.mapSeries(orders, (order) => order.pickReceiptNumber());

    Utils.createdSuccessHandler(res, 'Invoices')(orders);
  }));

  app.post('/forest/actions/download-invoice', wrap(async (req, res) => {
    const { id, label } = await Order.findById(req.body.data.attributes.ids[0]);
    const path = `${REST_API_URL}/forest/actions/pdf-invoice/`;

    res.redirect(`${path}${_.kebabCase(label)}.pdf?orderId=${id}&lang=fr-FR`);
  }));

  app.post('/forest/actions/send-payment-request', LEA, wrap(async (req, res) => {
    const orders = await Order.findAll({
        where: { id: { [Op.in]: req.body.data.attributes.ids } },
        include: [{ model: Client }, { model: OrderItem }],
      })
      .map((order) => Promise.all([
        { order, client: order.Client },
        order.getCalculatedProps(),
      ]))
      .map(([{ order, client }, { amount, balance }]) =>
        order.sendPaymentRequest({ client, amount, balance })
      );

    Utils.sentSuccessHandler(res, 'Payment Request')(orders);
  }));

  app.get('/forest/Order/:orderId/relationships/Refunds', LEA, wrap(async (req, res) => {
    const credits = await Credit.findAll({
      where: { '$Payment.OrderId$': req.params.orderId },
      include: [{ model: Payment }],
    });
    const result = await new Serializer(Liana, Credit, credits, {}, {
      count: credits.length,
    }).perform();

    res.send(result);
  }));

  app.post('/forest/actions/cancel-order', LEA, wrap(async (req, res) => {
    const { ids } = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t cancel multiple orders');
    }

    const order = await Order.findOne({
      where: { id: ids[0] },
      include: [
        { model: OrderItem },
        { model: Payment },
      ],
    });
    const result = await order.destroyOrCancel();

    Utils.createdSuccessHandler(res, 'Cancel invoice')(result);
  }));
};
