const Promise     = require('bluebird');
const bodyParser  = require('body-parser');
const uuid        = require('uuid/v4');
const reduce      = require('lodash/reduce');
const D           = require('date-fns');
const Liana       = require('forest-express-sequelize');
const Ninja       = require('../../vendor/invoiceninja');
const Utils       = require('../../utils');

const _ = { reduce };

module.exports = (app, models, Client) => {
  const LEA = Liana.ensureAuthenticated;

  app.post('/forest/actions/create-rent-order', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;
    const month = values.for === 'current month' ?
      D.startOfMonth(Date.now()) :
      D.addMonths(Date.now(), 1);

    Promise.resolve()
      .then(() => {
        if (!values.for) {
          throw new Error('"for" field is required');
        }

        return Client.scope(
          { method: ['rentOrdersFor', month] }, // required by createRentOrders
          'uncashedDepositCount' // required by findOrCreateRentOrder
        ).findAll({ where: { id: { $in: ids } } });
      })
      .then((clients) => {
        return Client.createRentOrders(clients, month);
      })
      .then(Utils.createSuccessHandler(res, 'Renting Order'))
      .catch(Utils.logAndSend(res));

    return null;
  });

  app.post('/forest/actions/credit-client', LEA, (req, res) => {
    const idCredit = uuid();
    const {values, ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if (
          !values.cardNumber || !values.cardType ||
          !values.expirationMonth || !values.expirationYear ||
          !values.cvv || !values.cardHolder || !values.amount
        ) {
          throw new Error('All fields are required');
        }

        if (ids.length > 1) {
          throw new Error('Can\'t credit multiple clients');
        }

        values.amount *= 100;

        return Client.paylineCredit(ids[0], values, idCredit);
      })
      .then(Utils.createSuccessHandler(res, 'Payline credit'))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/Invoices', LEA, (req, res) => {
    Client
      .findById(req.params.recordId)
      .then((client) => {
        return Ninja.invoice.listInvoices({
         'client_id': client.ninjaId,
        });
      })
      .then((response) => {
        const {data} = response.obj;

        return res.send({
          data: data.map((invoice) => {
            return {
              id: invoice.id,
              type: 'Invoice',
              attributes: {
                href: `${Ninja.URL}/invoices/${invoice.id}/edit`,
              },
            };
          }),
          meta: {count: data.length},
        });
      })
      .catch(Utils.logAndSend(res));
  });

  let urlencodedParser = bodyParser.urlencoded({ extended: true });

  /*
    Handle JotForm data (Identity - New Member)
    in order to collect more information for a new client
  */
  app.post('/forest/actions/clientIdentity', urlencodedParser, LEA, (req, res) => {
    const values = _.reduce(req.body, function(result, value, key) {
      let newKey = key.replace(/(q[\d]*_)/g, '');

      result[newKey] = value;
      return result;
    }, {});

    Client
      .findById(values.clientId)
      .tap((client) => {
          return client
            .set('phoneNumber', `${values.phoneNumber[0]}${values.phoneNumber[1]}`)
            .save();
      })
     .then((client) => {
        return client.createMetadata(values);
      })
      .then(Utils.createSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Client,
    associatedModel: models.Renting,
    routeName: 'draft-rentings',
    scope: 'draft',
    where: (req) => {
      return { ClientId: req.params.recordId };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Client);
};
