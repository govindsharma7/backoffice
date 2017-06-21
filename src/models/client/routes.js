const Promise     = require('bluebird');
const bodyParser  = require('body-parser');
const uuid        = require('uuid/v4');
const reduce      = require('lodash/reduce');
const Liana       = require('forest-express-sequelize');
const Ninja       = require('../../vendor/invoiceninja');
const Utils       = require('../../utils');
const {
  INVOICENINJA_URL,
}                 = require('../../const');

const _ = { reduce };

module.exports = (app, models, Client) => {
  const LEA = Liana.ensureAuthenticated;

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

  // TODO: shouldn't this be a renting action??
  app.post('/forest/actions/generate-lease', LEA, (req, res) => {
    const {ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1) {
          throw new Error('Can\'t create multiple leases');
        }

        return Client.scope(
          'currentApartment', // required by #generateLease
          'metadata' // required by #generateLease
        ).findById(ids[0]);
      })
      .then((client) => {
        if ( !client.Metadata.length ) {
          throw new Error('Metadata are missing for this client');
        }
        if ( !client.Rentings.length ) {
          throw new Error('This client has no renting yet');
        }
        // TODO: this won't work, as comfortLevel scope isn't loaded
        // we'll fix this once we move it to Renting actions
        if ( !client.Rentings[0].get('comfortLevel') ) {
          throw new Error('Housing pack is required to generate lease');
        }

        return client.generateLease();
      })
      .then(Utils.createSuccessHandler(res, 'Lease'))
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
                href: `${INVOICENINJA_URL}/invoices/${invoice.id}/edit`,
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

  app.post('/forest/actions/change-do-not-cash-deposit-option', LEA, (req, res) => {
    const {ids, values} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple deposit order');
        }
        if ( !values.option ) {
          throw new Error('Option field is required');
        }
        return Client.scope('depositOrder').findById(ids[0]);
      })
      .then((client) => {
        if ( !client.Rentings.length ) {
          throw new Error('This client has no renting yet');
        }
        if ( !client.Orders.length ) {
          throw new Error('This client has no deposit order yet');
        }
        return client.changeDepositOption(values.option);
      })
      .then(Utils.createSuccessHandler(res, 'Deposit change option'))
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
