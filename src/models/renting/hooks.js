const Promise                    = require('bluebird');
const Utils                      = require('../../utils');
const Sendinblue                 = require('../../vendor/sendinblue');

module.exports = function({ Renting, Room, Apartment, Client, Order }) {
  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees on creation
    if (
      !( 'RoomId' in renting.dataValues ) ||
      !( 'bookingDate' in renting.dataValues ) ||
      ( renting.price != null && renting.price > 0 && !isNaN(renting.price) )
    ) {
      return renting;
    }

    return Room
      .findOne({
        where: { id: renting.RoomId },
        include: [{ model: Apartment }],
      })
      .then((room) => {
        return renting.calculatePriceAndFees(room);
      });
  });

  // Create quote orders if the housing pack has been set when creating the renting
  Renting.hook('afterCreate', (_renting, { transaction }) => {
    if (_renting.comfortLevel) {
      const promise = Renting.scope('room+apartment', 'client+paymentDelay')
        .findById(_renting.id, { transaction })
        .then((renting) => {
          return renting.createQuoteOrders(_renting);
        });

      return Utils.wrapHookPromise(promise);
    }

    return null;
  });

  // When a renting is updated to active:
  // - Make sure the client is active
  // - Send a welcomeEmail
  Renting.hook('afterUpdate', (renting) => {
    if ( !renting.changed('status') || !renting.status === 'active' ) {
      return true;
    }

    return Promise.resolve()
      .then(() => (
        Renting.scope('room+apartment').findById(
          renting.id,
          { include: [{ model: Client }] }
        )
      ))
      .then((renting) => {
        return Promise.all([
          renting,
          Order.scope('welcomeEmail')
            .findAll({ where: { ClientId: renting.ClientId } }),
          renting.Client.update({ status: 'active' }),
        ]);
      })
      .then(([renting, orders]) => {
        if ( !orders ) {
          throw new Error(
            `No orders found for renting ${renting.id}. Welcome email \
            couldn't be sent.`
          );
        }

        return Sendinblue.sendWelcomeEmail({
            rentOrder: orders.find(({ OrderItems }) => (
              OrderItems.some(({ ProductId }) => ( ProductId === 'rent' ))
            )),
            depositOrder: orders.find(({ OrderItems }) => (
              OrderItems.some(({ ProductId }) => ( /-deposit$/.test(ProductId) ))
            )),
            client: renting.Client,
            renting,
            room: renting.Room,
            apartment: renting.Room.Apartment,
          });
      });
  });
};
