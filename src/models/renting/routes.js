const Promise         = require('bluebird');
const Liana           = require('forest-express-sequelize');
const capitalize      = require('lodash/capitalize');
const pick            = require('lodash/pick');
const D               = require('date-fns');
const Utils           = require('../../utils');
const makePublic      = require('../../middlewares/makePublic');

const _ = { capitalize, pick };

module.exports = function(app, models, Renting) {
  const LEA = Liana.ensureAuthenticated;

  // Make this route completely public
  app.get('/forest/Renting/:rentingId', makePublic);

  app.post('/forest/actions/create-pack-order', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= 100;
    }

    Promise.resolve()
      .then(() => {
        if ( !values.comfortLevel ) {
          throw new Error('Please select a comfort level');
        }
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple housing-pack orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => {
        return renting.findOrCreatePackOrder(values.comfortLevel, values.discount);
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Housing pack order'))
      .catch(Utils.logAndSend(res));

    return null;
  });

  app.post('/forest/actions/generate-lease', LEA, (req, res) => {
    const {ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1) {
          throw new Error('Can\'t create multiple leases');
        }

        return Renting.scope(
          'comfortLevel', // required by #generateLease
          'client+identity', // required by #generateLease
          'room+apartment', // required by #generateLease
          'depositOption'// required by #generateLease
        ).findById(ids[0]);
      })
      .then((renting) => {
        if ( !renting.Client.Metadata.length ) {
          throw new Error('Identity record is missing for this client');
        }
        if ( !renting.get('comfortLevel') ) {
          throw new Error('Housing pack is required to generate lease');
        }
        return renting.generateLease();
      })
      .then(Utils.createSuccessHandler(res, 'Lease'))
      .catch(Utils.logAndSend(res));
  });
  app.post('/forest/actions/create-deposit-order', LEA, (req, res) => {
    const {ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple deposit orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => {
        return renting.findOrCreateDepositOrder();
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Deposit order'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/create-first-rent-order', LEA, (req, res) => {
    const {ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple rent orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => {
        return renting.findOrCreateRentOrder({ date: renting.bookingDate });
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Rent order'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/create-quote-orders', LEA, (req, res) => {
    const { values: {comfortLevel, discount}, ids } = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( !comfortLevel ) {
          throw new Error('Please select a comfort level');
        }
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple housing-pack orders');
        }

        return Renting.scope('room+apartment').findById(ids[0]);
      })
      .then((renting) => {
        return renting.createQuoteOrders({
          comfortLevel,
          discount: discount * 100,
        });
      })
      .then(Utils.createSuccessHandler(res, 'Quote order'))
      .catch(Utils.logAndSend(res));
  });

  // add-checkin-date, add-checkout-date, create-checkin-order and
  // create-checkout-order routes
  ['checkin', 'checkout'].forEach((type) => {
    app.post(`/forest/actions/add-${type}-date`, LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
      .then(() => {
        if ( !values.dateAndTime ) {
          throw new Error('Please select a planned date');
        }
        if ( ids.length > 1 ) {
          throw new Error(`Can't create multiple ${type} events`);
        }

        return Renting.scope(
          'room+apartment', // required to create the event
          'client' // required to create the event
        ).findById(ids[0]);
      })
      .then((renting) => {
        return renting[`findOrCreate${_.capitalize(type)}Event`](
          values.dateAndTime, {}
        );
      })
      .then(Utils.findOrCreateSuccessHandler(res, `${_.capitalize(type)} event`))
      .catch(Utils.logAndSend(res));

      return null;
    });

    app.post(`/forest/actions/create-${type}-order`, LEA, (req, res) => {
      const {ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if ( ids.length > 1 ) {
            throw new Error(`Can't create multiple ${type} orders`);
          }

          return Renting.scope(
            'room+apartment', // required to create checkin/out order
            'client', // required to create the refund event,
            `${type}Date`, // required below
            'comfortLevel' // required below
          ).findById(ids[0]);
        })
        .then((renting) => {
          if ( !renting.get(`${type}Date`) || !renting.get('comfortLevel') ) {
            throw new Error(Utils.toSingleLine(`
              ${_.capitalize(type)} event and housing pack are required to
              create ${_.capitalize(type)} order
            `));
          }

          return renting[`findOrCreate${_.capitalize(type)}Order`]();
        })
        .tap(([order, isCreated]) => {
          // We create the refund event once the checkout order is created,
          // as the checkout date is more reliable at this point
          return Promise.all([
            type === 'checkout' && isCreated &&
              this.createOrUpdateRefundEvent(this.get('checkoutDate')),
            isCreated && models.Order.ninjaCreateInvoices([order]),
          ]);
        })
        .then(Utils.findOrCreateSuccessHandler(res, `${_.capitalize(type)} order`))
        .catch(Utils.logAndSend(res));
      });
  });

  app.post('/forest/actions/public/create-client-and-renting', makePublic, (req, res) => {
    const { roomId, pack: comfortLevel, client, currentPrice, bookingDate } =
      req.body;

    models.Room.scope('apartment', 'availableAt')
      .findById(roomId)
      .then((room) => {
        if ( !room ) {
          throw new Error(`Room "${roomId}" not found`);
        }

        if ( D.compareAsc(room.availableAt, new Date(bookingDate) ) > -1 ) {
          throw new Error(`Room "${roomId}" unavailable on ${bookingDate}`);
        }

        return Promise.all([
          room.getCalculatedProps(Math.max(room.availableAt, new Date())),
          models.Client.findOrCreate({
            where: { email: client.email },
            defaults: _.pick(client, ['firstName', 'lastName', 'email']),
          }),
          room,
        ]);
      })
      .then(([{periodPrice, serviceFees}, [client], room]) => {
        if ( periodPrice !== currentPrice ) {
          throw new Error(
            `Room "${roomId}"'s price has changed and is now ${periodPrice}`
          );
        }

        return Promise.all([
          Renting.findOrCreate({
            where: { ClientId: client.id, RoomId: roomId },
            defaults: {
              ClientId: client.id,
              RoomId: roomId,
              price: periodPrice,
              serviceFees,
              bookingDate,
            },
          }),
          room,
        ]);
      })
      .tap(([[renting, isCreated], room]) => {
        return isCreated && renting.createQuoteOrders({ comfortLevel, room });
      })
      .then(([[renting]]) => {
        return res.send({ rentingId: renting.id });
      })
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/update-do-not-cash-deposit-option', LEA, (req, res) => {
    const {ids, values} = req.body.data.attributes;

    Promise.resolve()
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
      .then(() => {
        return res.send({success: 'Deposit option successfuly updated'});
      })
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/create-room-switch-order', LEA, (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= 100;
    }

    Promise.resolve()
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
    .then(Utils.createSuccessHandler(res, 'Room switch order'))
    .catch(Utils.logAndSend(res));

    return null;
  });

  app.post('/forest/actions/future-credit', LEA, (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.discount != null ) {
      values.discount *= -100;
    }

    Promise.resolve()
    .then(() => {
      if ( ids.length > 1 ) {
        throw new Error('Can\'t credit multiple rentings');
      }

      return Renting.findById(ids[0]);
    })
    .then((renting) => {
      return renting.futureCredit(values);
    })
    .then(Utils.createSuccessHandler(res, 'Future credit'))
    .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/future-debit', LEA, (req, res) => {
    const {ids, values} = req.body.data.attributes;

    if ( values.amount != null ) {
      values.amount *= 100;
    }

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1) {
          throw new Error('Can\'t debit multiple rentings');
        }

        return Renting.findById(ids[0]);
      })
      .then((renting) => {
        return renting.futureDebit(values);
      })
      .then(Utils.createSuccessHandler(res, 'Future debit'))
      .catch(Utils.logAndSend(res));
  });

  Utils.addRestoreAndDestroyRoutes(app, Renting);
};
