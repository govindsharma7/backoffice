const Promise     = require('bluebird');
const uuid        = require('uuid/v4');
const mapKeys     = require('lodash/mapKeys');
const D           = require('date-fns');
const Multer      = require('multer');
const Liana       = require('forest-express-sequelize');
const Ninja       = require('../../vendor/invoiceninja');
const Utils       = require('../../utils');
const {
  INVOICENINJA_URL,
}                 = require('../../const');

const _ = { mapKeys };

module.exports = (app, models, Client) => {
  const LEA = Liana.ensureAuthenticated;
  const multer = Multer().fields([{ name: 'passport', maxCount: 1 }]);

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

  /*
    Handle JotForm data (Identity - New Member)
    in order to collect more information for a new client
  */
  app.post('/forest/actions/clientIdentity', multer, LEA, (req, res) => {
     const values = _.mapKeys(JSON.parse(req.body.rawRequest), (value, key) => {
       return key.replace(/(q[\d]*_)/g, '');
     });
    const phoneNumber = `${values.phoneNumber.area}${values.phoneNumber.phone}`;

    Client
      .findById(values.clientId)
      .then((client) => {
        return Promise.all([
          /^(\+|0{2})\d{5,}$/.test(phoneNumber) ? client.update({
            phoneNumber,
          }) : null,
          models.Metadata
            .create({
              metadatable: 'Client',
              MetadatableId: client.id,
              name: 'clientIdentity',
              value: JSON.stringify(values),
            }),
          ]);
      })
      .then(Utils.createSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Client,
    associatedModel: models.Renting,
    routeName: 'Rentings',
    scope: 'untrashed',
    where: (req) => {
      return { ClientId: req.params.recordId };
    },
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Client,
    associatedModel: models.Order,
    routeName: 'Orders',
    scope: 'untrashed',
    where: (req) => {
      return { ClientId: req.params.recordId };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Client);
};
