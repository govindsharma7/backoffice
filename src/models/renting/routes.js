const Promise           = require('bluebird');
const Liana             = require('forest-express-sequelize');
const { wrap }          = require('express-promise-wrap');
const _                 = require('lodash');
const D                 = require('date-fns');
const Webmerge          = require('../../vendor/webmerge');
const Utils             = require('../../utils');
const makePublic        = require('../../middlewares/makePublic');

const { CNError } = Utils;

module.exports = function(app, { Renting, Client, Room, Apartment }) {
  const LEA = Liana.ensureAuthenticated;

  // The frontend needs this route to be public
  app.get('/forest/Renting/:rentingId', makePublic);

  app.post('/forest/actions/create-pack-order', LEA, wrap(async (req, res) => {
    const {
      values: { packLevel, discount = 0 },
      ids,
    } = req.body.data.attributes;

    if ( !packLevel ) {
      throw new Error('Please select a comfort level');
    }
    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple housing-pack orders');
    }

    const renting = await Renting.scope('room+apartment').findById(ids[0]);
    const result = await renting.findOrCreatePackOrder({
      packLevel,
      discount: discount * 100,
      apartment: renting.Room.Apartment,
    });

    Utils.foundOrCreatedSuccessHandler(res, 'Housing pack order')(result);
  }));

  app.post('/forest/actions/create-deposit-order', LEA, wrap(async (req, res) => {
    const { ids } = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple deposit orders');
    }

    const renting = await Renting.scope('room+apartment').findById(ids[0]);
    const apartment = renting.Room.Apartment;
    const result = await renting.findOrCreateDepositOrder({ apartment });

    Utils.foundOrCreatedSuccessHandler(res, 'Deposit order')(result);
  }));

  app.post('/forest/actions/create-first-rent-order', LEA, wrap(async (req, res) => {
    const {ids} = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple rent orders');
    }

    const renting = await Renting.scope('room+apartment').findById(ids[0]);
    const result = await renting.findOrCreateRentOrder({ room: renting.Room });

    Utils.foundOrCreatedSuccessHandler(res, 'Rent order')(result);
  }));

  app.post('/forest/actions/create-quote-orders', LEA, wrap(async (req, res) => {
    const { values, ids } = req.body.data.attributes;
    const { packLevel: packLevel, discount } = values;

    if ( !packLevel ) {
      throw new Error('Please select a comfort level');
    }
    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple housing-pack orders');
    }

    const renting = await Renting.scope('room+apartment').findById(ids[0]);
    const result = await renting.createQuoteOrders({
      packLevel,
      discount: discount * 100,
      room: renting.Room,
      apartment: renting.Room.Apartment,
    });

    Utils.createdSuccessHandler(res, 'Quote order')(result);
  }));

  app.post('/forest/actions/generate-lease', LEA, wrap(async (req, res) => {
    const { ids } = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple leases');
    }

    const renting = await Renting.scope('room+apartment', 'depositOption')
      .findById(ids[0]);
    // Take the comfort level from clients, as they might be switching room
    const client = await Client.scope('_packLevel', 'clientMeta')
      .findById(renting.ClientId);

    if ( !client.identityRecord ) {
      throw new Error('Identity record is missing for this client');
    }
    if ( !client.get('packLevel') ) {
      throw new Error('Housing pack is required to generate lease');
    }

    const lease = await Webmerge.mergeLease({
      renting,
      client,
      identityRecord: client.identityRecord,
      room: renting.Room,
      apartment: renting.Room.Apartment,
      depositTerm: renting.Terms && renting.Terms[0],
      packLevel: client.get('packLevel'),
    });

    return Utils.createdSuccessHandler(res, 'Lease')(lease);
  }));

  // add-checkin-date, add-checkout-date, create-checkin-order and
  // create-checkout-order routes
  ['checkin', 'checkout'].forEach((type) => {
    const capType = _.capitalize(type);

    Renting[`add${capType}DateHandler`] = async function({ values, ids }) {
      if ( ids.length > 1 ) {
        throw new Error(`Can't create multiple ${type} events`);
      }

      const methodName = `findOrCreate${capType}Event`;
      const renting = await Renting.scope('room+apartment').findOne({
        where: { id: ids[0] },
        include: [{ model: Client }], // required to create the event
      });

      return renting[methodName]({
        startDate: values.dateAndTime,
        client: renting.Client,
        room: renting.Room,
        apartment: renting.Room.Apartment,
      });
    };
    app.post(`/forest/actions/add-${type}-date`, LEA, wrap(async (req, res) => {
      const result =
        await Renting[`add${capType}DateHandler`](req.body.data.attributes);

      Utils.foundOrCreatedSuccessHandler(res, `${capType} event`)(result);
    }));

    app.post(`/forest/actions/create-${type}-order`, LEA, wrap(async (req, res) => {
      const {ids} = req.body.data.attributes;

      if ( ids.length > 1 ) {
        throw new Error(`Can't create multiple ${type} orders`);
      }

      const renting = await Renting.scope(
        'room+apartment', // required to create checkin/out order
        `${type}Date`, // required below
        'packLevel' // required below
      ).findById(ids[0], {
        include: [{ model: Client }], // required to create the refund event
      });

      if ( !renting.get(`${type}Date`) || !renting.get('packLevel') ) {
        throw new Error([
          `${capType} event and housing pack are required to `,
          `create ${capType} order`,
        ].join(''));
      }

      /* eslint-disable no-unused-vars */ // see todo below
      const result = await renting[`findOrCreate${capType}Order`]();
      /* eslint-enable no-unused-vars */

      // TODO: we've disabled that broken feature. Fix it and re-enable
      // if ( type === 'checkout' && result.isCreated ) {
      //   await this.createOrUpdateRefundEvent(this.get('checkoutDate'))
      // }

      Utils.foundOrCreatedSuccessHandler(res, `${capType} order`)(result);
    }));
  });

  const createClientRoute = '/forest/actions/public/create-client-and-renting';

  Renting.handleCreateClientAndRentingRoute = async (args) => {
    const { roomId, pack: packLevel, booking } = args;
    const room = await Room.scope('availableAt').findById(roomId, {
      include: [Apartment],
    });

    if ( !room ) {
      throw new CNError(`Room ${roomId} not found`, {
        code: 'renting.roomNotFound',
      });
    }
    if ( room.availableAt == null ) {
      throw new CNError(`Room ${room.name} is no longer available`, {
        code: 'renting.roomUnavailable',
      });
    }

    const bookingDate = D.max(room.availableAt, Utils.now());
    const { Apartment: apartment, Apartment: { addressCity } } = room || {};
    const [{ price, serviceFees }, [client]] = await Promise.all([
      Room.getPriceAndFees({ room, apartment, date: bookingDate }),
      Client.findOrCreate({
        where: { email: booking.email },
        defaults: _.pick(booking, ['firstName', 'lastName', 'email']),
      }),
    ]);

    const [renting, isCreated] = await Renting.findOrCreate({
      where: {
        ClientId: client.id,
        RoomId: roomId,
        status: 'draft',
      },
      defaults: {
        ClientId: client.id,
        RoomId: roomId,
        price,
        serviceFees,
        bookingDate,
        packLevel,
      },
    });

    // The pack level might have changed, try to update it
    if ( !isCreated ) {
      await renting.updatePackLevel({ addressCity, packLevel });
    }

    return renting;
  };
  app.post(createClientRoute, makePublic, wrap(async (req, res) => {
    const renting = await Renting.handleCreateClientAndRentingRoute(req.body);

    return res.send({ rentingId: renting.id });
  }));

  const updateDepositOptionRoute = '/forest/actions/update-do-not-cash-deposit-option';

  app.post(updateDepositOptionRoute, LEA, wrap(async (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple deposit order');
    }
    if ( values.option == null ) {
      throw new Error('"Option" field is required');
    }

    await Renting
      .build({ id: ids[0] }, { isNewRecord: false })
      .changeDepositOption(values.option);

    res.send({success: 'Deposit option successfuly updated'});
  }));

  app.post('/forest/actions/create-room-switch-order', LEA, wrap(async (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= 100;
    }

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple room switch orders');
    }

    const renting = await Renting.scope('packLevel').findById(ids[0]);

    if ( renting.get('packLevel') == null ) {
      throw new Error('Housing pack is required to create room switch order');
    }

    const result = await renting.createRoomSwitchOrder(values);

    Utils.createdSuccessHandler(res, 'Room switch order')(result);
  }));

  app.post('/forest/actions/future-credit', LEA, wrap(async (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= -100;
    }

    if ( ids.length > 1 ) {
      throw new Error('Can\'t credit multiple rentings');
    }

    const renting = await Renting.findById(ids[0]);
    const result = await renting.futureCredit(values);

    Utils.createdSuccessHandler(res, 'Future credit')(result);
  }));

  app.post('/forest/actions/future-debit', LEA, wrap(async (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.amount != null ) {
      values.amount *= 100;
    }

    if ( ids.length > 1) {
      throw new Error('Can\'t debit multiple rentings');
    }

    const renting = await Renting.findById(ids[0]);
    const result = await renting.futureDebit(values);

    Utils.createdSuccessHandler(res, 'Future debit')(result);
  }));

  Utils.addRestoreAndDestroyRoutes(app, Renting);
};
