const Promise           = require('bluebird');
const Liana             = require('forest-express-sequelize');
const { wrap, CNError } = require('express-promise-wrap');
const capitalize        = require('lodash/capitalize');
const pick              = require('lodash/pick');
const Webmerge          = require('../../vendor/webmerge');
const Utils             = require('../../utils');
const makePublic        = require('../../middlewares/makePublic');

const _ = { capitalize, pick };

module.exports = function(app, { Renting, Client, Room }) {
  const LEA = Liana.ensureAuthenticated;

  // The frontend needs this route to be public
  app.get('/forest/Renting/:rentingId', makePublic);

  app.post('/forest/actions/create-pack-order', LEA, wrap((req, res) => {
    const {
      values: { comfortLevel, discount = 0 },
      ids,
    } = req.body.data.attributes;

    return Promise.resolve()
      .then(() => {
        if ( !comfortLevel ) {
          throw new Error('Please select a comfort level');
        }
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple housing-pack orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => renting.findOrCreatePackOrder({
        packLevel: comfortLevel,
        discount: discount * 100,
        apartment: renting.Room.Apartment,
      }))
      .then(Utils.foundOrCreatedSuccessHandler(res, 'Housing pack order'));
  }));

  app.post('/forest/actions/create-deposit-order', LEA, wrap((req, res) => {
    const {ids} = req.body.data.attributes;

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple deposit orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) =>
        renting.findOrCreateDepositOrder({ apartment: renting.Room.Apartment })
      )
      .then(Utils.foundOrCreatedSuccessHandler(res, 'Deposit order'));
  }));

  app.post('/forest/actions/create-first-rent-order', LEA, wrap((req, res) => {
    const {ids} = req.body.data.attributes;

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple rent orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => renting.findOrCreateRentOrder({ room: renting.Room }))
      .then(Utils.foundOrCreatedSuccessHandler(res, 'Rent order'));
  }));

  app.post('/forest/actions/create-quote-orders', LEA, wrap((req, res) => {
    const { values, ids } = req.body.data.attributes;
    const { comfortLevel: packLevel, discount } = values;

    return Promise.resolve()
      .then(() => {
        if ( !packLevel ) {
          throw new Error('Please select a comfort level');
        }
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple housing-pack orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => renting.createQuoteOrders({
        packLevel,
        discount: discount * 100,
        room: renting.Room,
        apartment: renting.Room.Apartment,
      }))
      .then(Utils.createdSuccessHandler(res, 'Quote order'));
  }));

  app.post('/forest/actions/generate-lease', LEA, wrap(async (req, res) => {
    const { ids } = req.body.data.attributes;

    if ( ids.length > 1 ) {
      throw new Error('Can\'t create multiple leases');
    }

    const renting = await Renting.scope('room+apartment', 'depositOption')
      .findById(ids[0]);
    // Take the comfort level from clients, as they might be switching room
    const client = await Client.scope('comfortLevel', 'identity')
      .findById(renting.ClientId);

    if ( !client.Metadata.length ) {
      throw new Error('Identity record is missing for this client');
    }
    if ( !client.get('comfortLevel') ) {
      throw new Error('Housing pack is required to generate lease');
    }

    const lease = await Webmerge.mergeLease({
      renting,
      client,
      room: renting.Room,
      apartment: renting.Room.Apartment,
      depositTerm: renting.Terms && renting.Terms[0],
      identityMeta: client.Metadata && client.Metadata[0],
      comfortLevel: client.get('comfortLevel'),
    });

    return Utils.createdSuccessHandler(res, 'Lease')(lease);
  }));

  // add-checkin-date, add-checkout-date, create-checkin-order and
  // create-checkout-order routes
  ['checkin', 'checkout'].forEach((type) => {
    app.post(`/forest/actions/add-${type}-date`, LEA, wrap((req, res) => {
      const {values, ids} = req.body.data.attributes;

      return Promise.resolve()
        .then(() => {
          if ( !values.dateAndTime ) {
            throw new Error('Please select a planned date');
          }
          if ( ids.length > 1 ) {
            throw new Error(`Can't create multiple ${type} events`);
          }

          return Renting.scope('room+apartment') // required to create the event
            .findOne({
              where: { id: ids[0] },
              include: [{ model: Client }], // required to create the event
            });
        })
        .then((renting) => {
          return renting[`findOrCreate${_.capitalize(type)}Event`](
            values.dateAndTime, {}
          );
        })
        .then(Utils.foundOrCreatedSuccessHandler(res, `${_.capitalize(type)} event`));
    }));

    app.post(`/forest/actions/create-${type}-order`, LEA, wrap(async (req, res) => {
      const {ids} = req.body.data.attributes;

      if ( ids.length > 1 ) {
        throw new Error(`Can't create multiple ${type} orders`);
      }

      const renting = await Renting.scope(
        'room+apartment', // required to create checkin/out order
        `${type}Date`, // required below
        'comfortLevel' // required below
      ).findById(ids[0], {
        include: [{ model: Client }], // required to create the refund event
      });

      if ( !renting.get(`${type}Date`) || !renting.get('comfortLevel') ) {
        throw new Error(Utils.toSingleLine(`
          ${_.capitalize(type)} event and housing pack are required to
          create ${_.capitalize(type)} order
        `));
      }

      /* eslint-disable no-unused-vars */ // see todo below
      const [, isCreated] = await renting[`findOrCreate${_.capitalize(type)}Order`]();
      /* eslint-enable no-unused-vars */

      // TODO: we've disabled that broken feature. Fix it and re-enable
      // if ( type === 'checkout' && isCreated ) {
      //   await this.createOrUpdateRefundEvent(this.get('checkoutDate'))
      // }

      Utils.foundOrCreatedSuccessHandler(res, `${_.capitalize(type)} order`);
    }));
  });

  const createClientRoute = '/forest/actions/public/create-client-and-renting';

  app.post(createClientRoute, makePublic, wrap(async (req, res) => {
    const { roomId, pack: packLevel } = req.body;
    // TODO: following line to maintain backward compat. Get rid of it in a bit
    const booking = req.body.booking || req.body.client;
    const room = await Room.scope('apartment+availableAt').findById(roomId);
    const { Apartment: apartment } = room || {};

    if ( !room ) {
      throw new CNError(`Room ${roomId} not found`, {
        code: 'renting.roomNotFound',
      });
    }

    const bookingDate =
      await Room.getEarliestAvailability({ rentings: room.Rentings });

    if ( !bookingDate ) {
      throw new CNError(`Room ${roomId} is no longer available`, {
        code: 'renting.roomUnavailable',
      });
    }

    const [{ periodPrice, serviceFees }, [client]] = await Promise.all([
      room.getCalculatedProps(bookingDate),
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
        price: periodPrice,
        serviceFees,
        bookingDate,
      },
    });

    if ( isCreated ) {
      await renting.createQuoteOrders({ packLevel, room, apartment });
    }
    // The pack level might have changed, try to update it
    else {
      await renting.updatePackLevel({ addressCity: apartment.addressCity, packLevel });
    }

    return res.send({ rentingId: renting.id });
  }));

  app.post('/forest/actions/update-do-not-cash-deposit-option', LEA, wrap((req, res) => {
    const {ids, values} = req.body.data.attributes;

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple deposit order');
        }
        if ( values.option == null ) {
          throw new Error('"Option" field is required');
        }

        return Renting.build({ id: ids[0] }, { isNewRecord: false })
          .changeDepositOption(values.option);
      })
      .then(() => res.send({success: 'Deposit option successfuly updated'}));
  }));

  app.post('/forest/actions/create-room-switch-order', LEA, wrap((req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= 100;
    }

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple room switch orders');
        }

        return Renting.scope(
          'comfortLevel' // required below
        ).findById(ids[0]);
      })
      .then((renting) => {
        if ( renting.get('comfortLevel') == null ) {
          throw new Error('Housing pack is required to create room switch order');
        }

        return renting.createRoomSwitchOrder(values);
      })
      .then(Utils.createdSuccessHandler(res, 'Room switch order'));
  }));

  app.post('/forest/actions/future-credit', LEA, wrap((req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= -100;
    }

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t credit multiple rentings');
        }

        return Renting.findById(ids[0]);
      })
      .then((renting) => renting.futureCredit(values))
      .then(Utils.createdSuccessHandler(res, 'Future credit'));
  }));

  app.post('/forest/actions/future-debit', LEA, wrap((req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.amount != null ) {
      values.amount *= 100;
    }

    return Promise.resolve()
      .then(() => {
        if ( ids.length > 1) {
          throw new Error('Can\'t debit multiple rentings');
        }

        return Renting.findById(ids[0]);
      })
      .then((renting) => renting.futureDebit(values))
      .then(Utils.createdSuccessHandler(res, 'Future debit'));
  }));

  Utils.addRestoreAndDestroyRoutes(app, Renting);
};
