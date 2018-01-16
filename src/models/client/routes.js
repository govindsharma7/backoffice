const Promise              = require('bluebird');
const uuid                 = require('uuid/v4');
const pickBy               = require('lodash/pickBy');
const mapKeys              = require('lodash/mapKeys');
const D                    = require('date-fns');
const Multer               = require('multer');
const Liana                = require('forest-express-sequelize');
const {
  SENDINBLUE_LIST_IDS,
  SENDINBLUE_TEMPLATE_IDS,
}                          = require('../../const');
const { INVOICENINJA_URL } = require('../../config');
const Ninja                = require('../../vendor/invoiceninja');
const Sendinblue           = require('../../vendor/sendinblue');
const Utils                = require('../../utils');

const _ = { pickBy, mapKeys };

module.exports = (app, models, Client) => {
  const LEA = Liana.ensureAuthenticated;
  const multer = Multer().fields([{ name: 'passport', maxCount: 1 }]);
  const Serializer = Liana.ResourceSerializer;

  app.delete('/forest/Client/:clientId/relationships/Orders', LEA, (req, res) => {
    const ids = [];

    req.body.data
      .filter((_data) => _data.type === 'order')
      .map((order) => ids.push(order.id));

    models.Order
      .findAll({ where: { id: { $in: ids } } })
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
        ).findAll({ where: { id: { $in: ids } } });
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
        return Client.findAll({ where: { id: { $in: ids } } });
      })
      .mapSeries((client) => models.Metadata.createOrUpdate({
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

  app.post('/forest/actions/add-note', LEA, (req, res) => {
    const {values, ids, collection_name: metadatable} =
      req.body.data.attributes;

    models.Metadata.bulkCreate(ids.map((MetadatableId) => ({
        name: 'note',
        metadatable,
        MetadatableId,
        value: values.content,
      })))
      .then(Utils.createdSuccessHandler(res, `${metadatable} Note`))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/Invoices', LEA, (req, res) => {
    Client
      .findById(req.params.recordId)
      .then((client) => Ninja.invoice.listInvoices({ 'client_id': client.ninjaId }))
      .then((response) => {
        const {data} = response.obj;

        return res.send({
          data: data.map((invoice) => ({
            id: invoice.id,
            type: 'Invoice',
            attributes: {
              href: `${INVOICENINJA_URL}/invoices/${invoice.id}/edit`,
            },
          })),
          meta: {count: data.length},
        });
      })
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/Payments', LEA, (req, res) => {
    models.Payment
      .findAll({
        include: [{
          model: models.Order,
          attributes: [],
          where: { ClientId: req.params.recordId },
        }],
      })
      .then((payments) =>
        new Serializer(Liana, models.Payment, payments, null, {}, {
          count: payments.length,
        }).perform()
      )
      .then((data) => res.send(data))
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/jotform-attachments',
    LEA,
    (req, res) => {
    models.Metadata
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

  app.post('/forest/actions/rental-attachments', multer, LEA, (req, res) => {
    const values = _.mapKeys(
      JSON.parse(req.body.rawRequest),
      (value, key) => key.replace(/(q[\d]*_)/g, '')
    );
    const scoped = Client.scope('latestClientRenting');

    Promise
      .resolve(/@/.test(values.clientId) ?
        scoped.findAll({ where: { email: values.clientId.trim() } }) :
        scoped.findAll({ where: { id: values.clientId.trim() } }))
      .then(([client]) => client.createMetadatum({
        name: 'rentalAttachments',
        value: JSON.stringify(values),
      }))
      .then(Utils.createdSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  /*
    Handle JotForm data (Identity - New Member)
    in order to collect more information for a new client
  */
  app.post('/forest/actions/client-identity', multer, LEA, (req, res) => {
    Client.normalizeIdentityRecord(JSON.parse(req.body.rawRequest))
      .then((identityRecord) => {
        const { fullName, phoneNumber, clientId, iPrefer } = identityRecord;
        const fieldsToUpdate = {
          firstName: fullName.first,
          lastName: fullName.last,
          phoneNumber: Utils.isValidPhoneNumber( phoneNumber ) && phoneNumber,
          preferredLanguage: iPrefer === 'Français' ? 'fr' : 'en',
        };
        const scoped = Client.scope('latestClientRenting');

        if ( !clientId ) {
          throw new Error('clientId is missing');
        }

        return Promise.all([
          /@/.test(clientId) ?
            scoped.findAll({ where: { email: clientId.trim() } }) :
            scoped.findAll({ where: { id : clientId.trim() } }),
          fieldsToUpdate,
          identityRecord,
        ]);
      })
      .tap(([[client], fieldsToUpdate, identityRecord]) => {
        const { year, month, day, hour, min } = identityRecord.checkinDate;
        const startDate = `${year}-${month}-${day} ${hour}:${min}`;
        const {addressCity} = client.Rentings[0].Room.Apartment;
        const {preferredLanguage} = client;

        return Promise.all([
          client.update(
            _.pickBy(fieldsToUpdate, Boolean) // filter out falsy phoneNumber
          ),
          client.createMetadatum({ // sequelize pluralization ¯\_(ツ)_/¯
            name: 'clientIdentity',
            value: JSON.stringify(identityRecord),
          }),
          models.Renting.findOrCreateCheckinEvent({
            startDate,
            renting: client.Rentings[0],
            client,
            room: client.Rentings[0].Room,
          }),
          Sendinblue.updateContact(
            client.email,
            {
              listIds: [
                SENDINBLUE_LIST_IDS[preferredLanguage],
                SENDINBLUE_LIST_IDS[addressCity].all,
                SENDINBLUE_LIST_IDS[addressCity][preferredLanguage],
              ],
              unlinkListIds: [SENDINBLUE_LIST_IDS.prospects[preferredLanguage]],
            }),
        ]);
      })
      .then(([[client]]) => Promise.all([
        Client.scope('currentApartment').findAll({
          where: {
            '$Rentings->Room.ApartmentId$': client.Rentings[0].Room.ApartmentId,
            '$Rentings.bookingDate$': { $lte:  new Date() },
            'id': { $ne: client.id },
          },
        }),
        models.Metadata.findOne({
          where: {
            name: 'clientIdentity',
            MetadatableId: client.id,
          },
        }),
      ]))
      .then(([houseMates, metadata]) =>
        // TODO: this belongs in Sendinblue.js
        // and should be merged with the code in the following then.
        // see sendWelcomeEmail for example
         Utils.serializeHousemate(houseMates, metadata)
      )
      .then(([attributesFr, attributesEn, emailToFr, emailToEn]) => Promise.all([
        emailToFr.length && Sendinblue.sendTemplateEmail(
          SENDINBLUE_TEMPLATE_IDS.newHousemate.fr,
          { emailTo: emailToFr, attributes: attributesFr }
        ),
        emailToEn.length && Sendinblue.sendTemplateEmail(
          SENDINBLUE_TEMPLATE_IDS.newHousemate.en,
          { emailTo: emailToEn, attributes: attributesEn }
        ),
      ]))
      .then(Utils.createdSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Client,
    associatedModel: models.Metadata,
    routeName: 'Notes',
    where: (req) => ({ MetadatableId: req.params.recordId, name: 'note' }),
  });

  Utils.addRestoreAndDestroyRoutes(app, Client);
};
