const Promise     = require('bluebird');
const capitalize  = require('lodash/capitalize');
const Liana       = require('forest-express-sequelize');
const Utils       = require('../../utils');

const _ = { capitalize };

module.exports = function(app, models, Renting) {
  const LEA = Liana.ensureAuthenticated;

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
      .then(Utils.createSuccessHandler(res, 'Deposit order'))
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
        return renting.findOrCreateRentOrder(renting.bookingDate);
      })
      .then(Utils.createSuccessHandler(res, 'Rent order'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/create-quote-orders', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;

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
        return Promise.mapSeries([
          { suffix: 'RentOrder', args: [renting.bookingDate] },
          { suffix: 'DepositOrder' },
          { suffix: 'PackOrder', args: [values.comfortLevel, values.packDiscount] },
        ], (def) => {
          return renting[`findOrCreate${def.suffix}`].apply(renting, def.args);
        });
      })
      .then(([[rentOrder], [depositOrder], [packOrder]]) => {
        return models.Order.ninjaCreateInvoices([rentOrder, depositOrder, packOrder]);
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
        return renting[`findOrCreate${_.capitalize(type)}Event`](values.dateAndTime);
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
            'client', // required to create the refund event,
            `${type}Date`, // required below
            'comfortLevel' // required below
          ).findById(ids[0]);
        })
        .then((renting) => {
          if ( !renting.get(`${type}Date`) || !renting.get('comfortLevel') ) {
            throw new Error(Utils.stripIndent(`\
              ${_.capitalize(type)} event and housing pack are required to\
              create ${_.capitalize(type)} order`
            ));
          }

          return renting[`findOrCreate${_.capitalize(type)}Order`]();
        })
        .tap(([, isCreated]) => {
          // We create the refund event once the checkout order is created,
          // as the checkout date is more reliable at this point
          return type === 'checkout' && isCreated &&
            this.createOrUpdateRefundEvent(this.get('checkoutDate'));
        })
        .then(Utils.findOrCreateSuccessHandler(res, `${_.capitalize(type)} order`))
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

  Utils.addRestoreAndDestroyRoutes(app, Renting);
};
