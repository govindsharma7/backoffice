const Promise                     = require('bluebird');
const Sendinblue                  = require('../../vendor/sendinblue');
const Wordpress                   = require('../../vendor/wordpress');

module.exports = function({ Renting, Room, Apartment, Order, Client, OrderItem }) {
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
      .then((room) => renting.calculatePriceAndFees(room));
  });

  // When a renting is created with Housing Pack comfortLevel
  // - Create quote orders
  Renting.hook('afterCreate', (renting, { transaction }) => {
    const { comfortLevel, discount } = renting;

    if ( !comfortLevel ) {
      return true;
    }

    return Room
      .findById(renting.id, { include: [{ model: Apartment }], transaction })
      .then((room) => renting.createQuoteOrders({
        comfortLevel,
        discount: discount * 100,
        room,
        apartment: room.Apartment,
      }));
  });

  // When a renting is updated to active:
  // - Make sure the client is active
  // - Make sure related orders are active
  // - Send a welcomeEmail
  // - Mark the room unavailable in WordPress
  Renting.hook('afterUpdate', (_renting, { transaction }) => {
    if ( !_renting.changed('status') || _renting.status !== 'active' ) {
      return true;
    }

    return Promise.all([
      Renting.scope('room+apartment')
        .findById(_renting.id, { include: [{ model: Client }], transaction }),
      Order.findAll({
        where: { status: { $not: 'cancelled' } },
        include: [{
          model: OrderItem,
          where: { RentingId: _renting.id },
        }],
      }),
    ])
    .then(([renting, orders]) => {
      if ( !orders ) {
        throw new Error(
          `No orders found for renting ${renting.id}. Welcome email not sent.`
        );
      }

      const { Client: client, Room: room } = renting;
      const rentOrder = orders.find(({ OrderItems }) => (
        OrderItems.some(({ ProductId }) => ( ProductId === 'rent' ))
      ));
      const depositOrder = orders.find(({ OrderItems }) => (
        OrderItems.some(({ ProductId }) => ( /-deposit$/.test(ProductId) ))
      ));

      return Promise.all([
        Promise.all([client, rentOrder, depositOrder].map((instance) =>
          instance.status === 'draft' && instance.update({ status: 'active' })
        )),
        Wordpress.updateRoomAvailability({ room }),
        Sendinblue.sendWelcomeEmail({
          rentOrder,
          depositOrder,
          client,
          renting,
          room,
          apartment: room.Apartment,
        }),
      ]);
    });
  });
};
