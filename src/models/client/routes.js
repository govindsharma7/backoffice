const Promise               = require('bluebird');
const uuid                  = require('uuid/v4');
const _                     = require('lodash');
const D                     = require('date-fns');
const Multer                = require('multer');
const { wrap }              = require('express-promise-wrap');
const Liana                 = require('forest-express-sequelize');
const Op                    = require('../../operators');
const {
  SENDINBLUE_LIST_IDS,
}                           = require('../../const');
const Sendinblue            = require('../../vendor/sendinblue');
const Utils                 = require('../../utils');

module.exports = (app, { Client, Order, Metadata, Payment }) => {
  const LEA = Liana.ensureAuthenticated;
  const multer = Multer().fields([{ name: 'passport', maxCount: 1 }]);
  const Serializer = Liana.ResourceSerializer;

  app.delete('/forest/Client/:clientId/relationships/Orders', LEA, (req, res) => {
    const ids = [];

    req.body.data
      .filter((_data) => _data.type === 'order')
      .map((order) => ids.push(order.id));

    Order
      .findAll({ where: { id: { [Op.in]: ids } } })
      .map((order) => Promise.all([
        order,
        order.getCalculatedProps(),
      ]))
      .filter(([, { totalPaid }]) => totalPaid === null)
      .map(([order]) => order.destroy())
      .then(Utils.createdSuccessHandler(res, 'Orders'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/create-rent-order', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;
    const month = values.for === 'current month' ?
      D.startOfMonth(new Date()) :
      D.addMonths(new Date(), values.for.slice(-1));

    Promise.resolve()
      .then(() => {
        if (!values.for) {
          throw new Error('"for" field is required');
        }

        return Client.scope(
          { method: ['rentOrdersFor', month] }, // required by createRentOrders
          'uncashedDepositCount', // required by findOrCreateRentOrder
          'paymentDelay' // required by findOrCreateRentOrder
        ).findAll({ where: { id: { [Op.in]: ids } } });
      })
      .then((clients) => Client.createRentOrders(clients, month))
      .then(Utils.createdSuccessHandler(res, 'Renting Order'))
      .catch(Utils.logAndSend(res));

    return null;
  });

  app.post('/forest/actions/set-rent-payment-delay', LEA, (req, res) => {
    const { values, ids } = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( !values.addDelay ) {
          throw new Error('You must specify a delay');
        }
        return Client.findAll({ where: { id: { [Op.in]: ids } } });
      })
      .mapSeries((client) => Metadata.createOrUpdate({
        name: 'payment-delay',
        value: values.addDelay,
        metadatable: 'Client',
        MetadatableId: client.id,
      }))
      .then(Utils.createdSuccessHandler(res, 'New Due Date'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/credit-client', LEA, (req, res) => {
    const creditId = uuid();
    const { values, ids } = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if (
          'cardNumber,expirationMonth,expirationYear,cvv,cardHolder,amount'
            .split(',')
            .some((fieldName) => !(fieldName in values) )
        ) {
          throw new Error('All fields are required');
        }

        if (ids.length > 1) {
          throw new Error('Can\'t credit multiple clients');
        }

        values.cardType = Utils.getCardType(values.cardNumber);
        values.amount = parseFloat(values.amount) * 100;

        return Client.paylineCredit(ids[0], values, creditId);
      })
      .then(Utils.createdSuccessHandler(res, 'Payline credit'))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/Payments', LEA, (req, res) => {
    Payment
      .findAll({
        include: [{
          model: Order,
          attributes: [],
          where: { ClientId: req.params.recordId },
        }],
      })
      .then((payments) =>
        new Serializer(Liana, Payment, payments, null, {}, {
          count: payments.length,
        }).perform()
      )
      .then((data) => res.send(data))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/jotform-attachments',
    LEA,
    (req, res) => {
    Metadata
      .findAll({
        where: {
          name: 'rentalAttachments',
          MetadatableId : req.params.recordId,
        },
        order: ['createdAt'],
        limit: 1,
      })
      .then((metadata) => {
        if ( !metadata.length ) {
          return res.send({ data: [], meta: { count: 0 } });
        }

        let rUrl = /https:\/\/www\.jotformeu\.com\/uploads\/cheznestor\//g;
        const values = _.pickBy(
          JSON.parse(metadata[0].value),
          (value) => rUrl.test(value)
        );

        return res.send({
          data: Object.keys(values).map((key) => ({
            type: 'rentalAttachment',
            id: key,
            attributes: {
              href: values[key],
            },
          })),
          meta: { count: Object.keys(values).length },
        });
      })
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/rental-attachments', multer, LEA, async (req, res) => {
    const values = _.mapKeys(
      JSON.parse(req.body.rawRequest),
      (value, key) => key.replace(/(q[\d]*_)/g, '')
    );
    const clientId = values.clientId.trim();

    const client = await Client.findOne({
      where: /@/.test(clientId) ? { email: clientId } : { id: clientId },
    });

    return Metadata.create({
        MetadatableId: client.id,
        metadatable: 'Client',
        name: 'rentalAttachments',
        value: JSON.stringify(values),
      })
      .then(Utils.createdSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  /*
    Handle JotForm data
  */
  Client.handleClientIdentityRoute = async function(rawIdentity) {
    const identityRecord = await Client.normalizeIdentityRecord(rawIdentity);
    const { fullName, phoneNumber, clientId: _clientId, iPrefer } = identityRecord;
    const clientId = _clientId.trim();
    const fieldsToUpdate = {
      firstName: fullName.first,
      lastName: fullName.last,
      phoneNumber: Utils.isValidPhoneNumber( phoneNumber ) && phoneNumber,
      preferredLanguage: iPrefer === 'Français' ? 'fr' : 'en',
    };

    if ( !clientId ) {
      throw new Error('clientId is missing');
    }

    const client = await Client.scope('latestApartment').findOne({
      where: /@/.test(clientId) ? { email: clientId } : { id: clientId },
    });
    const { addressCity } = client.Rentings[0].Room.Apartment;
    const { preferredLanguage } = client;

    return Promise.all([
      client.update(
        _.pickBy(fieldsToUpdate, Boolean) // filter out falsy phoneNumber
      ),
      Metadata.create({
        MetadatableId: client.id,
        metadatable: 'Client',
        name: 'clientIdentity',
        value: JSON.stringify(identityRecord),
      }),
      Sendinblue.updateContact(client.email, {
        listIds: [
          SENDINBLUE_LIST_IDS[preferredLanguage],
          SENDINBLUE_LIST_IDS[addressCity].all,
          SENDINBLUE_LIST_IDS[addressCity][preferredLanguage],
        ],
        unlinkListIds: [SENDINBLUE_LIST_IDS.prospects[preferredLanguage]],
      }),
    ]);
  };
  app.post('/forest/actions/client-identity', multer, LEA, wrap(async (req, res) => {
    await Client.handleClientIdentityRoute(JSON.parse(req.body.rawRequest));

    res.send(true);
  }));

  Utils.addRestoreAndDestroyRoutes(app, Client);
};
