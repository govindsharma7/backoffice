const Promise                     = require('bluebird');
const Sendinblue                  = require('../../vendor/sendinblue');
const Wordpress                   = require('../../vendor/wordpress');

module.exports = function({ Renting, Room, Apartment, Order, Client, OrderItem }) {
  // When a renting is created or updated, verify:
  // - that the bookingDate is valid
  Renting.handleBeforeValidate = async (_renting) => {
    if ( !_renting.changed('bookingDate') ) {
      return true;
    }

    // we always need the RoomId in the handler
    const renting = await ( _renting.RoomId ? _renting : _renting.reload() );
    const room = await Room.scope('availableAt').findById(renting.RoomId);

    const isAvailable = await room.checkAvailability({
      // Exclude that renting from the list.
      // Otherwise we simply never can update the bookingDate of a renting
      // once it's created.
      rentings: room.Rentings.filter(({ id }) => id !== renting.id),
      date: renting.bookingDate,
    });

    if ( !isAvailable ) {
      throw new Error('The room is already booked');
    }

    return isAvailable;
  };
  Renting.hook('beforeValidate', (renting, opts) =>
    Renting.handleBeforeValidate(renting, opts)
  );

  // When a renting is created with 0€ price + fees:
  // - calculate correct price and service fees
  Renting.handleBeforeCreate = async (renting) => {
    if ( renting.price !== 0 || renting.serviceFees !== 0 ) {
      return renting;
    }

    const room = await Room.findOne({
      where: { id: renting.RoomId },
      include: [{ model: Apartment }],
    });

    return renting.calculatePriceAndFees(room);
  };
  Renting.hook('beforeCreate', (renting, opts) =>
    Renting.handleBeforeCreate(renting, opts)
  );

  // When a renting is created with a packLevel
  // - Create quote orders
  // - Send booking summary email
  Renting.handleAfterCreate = async (_renting, { transaction }) => {
    const { id, packLevel, discount = 0 } = _renting;

    const renting = await Renting.scope('room+apartment')
      .findById(id, { include: [{ model: Client }], transaction });
    const { Client: client, Room: room, Room: { Apartment: apartment } } = renting;

    // TODO: In theory we could use Promise.all instead of .mapSeries but this
    // produces SQLITE_BUSY errors in dev and test env :-/
    return Promise.mapSeries([
      () => Sendinblue.sendBookingSummaryEmail({
        client,
        renting,
        apartment,
      }),
      () => renting.createQuoteOrders({
        packLevel,
        discount: discount * 100,
        room,
        apartment,
      }),
    ], (fn) => fn());
  };
  Renting.hook('afterCreate', (renting, opts) =>
    Renting.handleAfterCreate(renting, opts)
  );

  // When a renting is updated to active:
  // - Make sure the client is active
  // - Make sure related orders are active
  // - Send a welcomeEmail
  // - Mark the room unavailable in WordPress
  Renting.handleAfterUpdate = async function(_renting, { transaction }) {
    if ( !_renting.changed('status') || _renting.status !== 'active' ) {
      return true;
    }

    const [renting, orders] = await Promise.all([
      Renting.scope('room+apartment')
        .findById(_renting.id, { include: [{ model: Client }], transaction }),
      Order.findAll({
        where: { status: { $not: 'cancelled' } },
        include: [{
          model: OrderItem,
          where: { RentingId: _renting.id },
        }],
      }),
    ]);

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
    const packLevel =
      orders
        .map(({ OrderItems }) => OrderItems)
        .reduce((acc, curr) => acc.concat(curr), [])
        .find(({ ProductId }) => ( /-pack$/.test(ProductId) ))
        .ProductId.replace('-pack', '');
    const activatePromises = [client, rentOrder, depositOrder].map((instance) =>
      instance.status === 'draft' && instance.update({ status: 'active' })
    );

    return Promise.all(activatePromises.concat(
      Wordpress.makeRoomUnavailable({ room }),
      Sendinblue.sendWelcomeEmail({
        rentOrder,
        depositOrder,
        client,
        renting,
        room,
        apartment: room.Apartment,
        packLevel,
      })
    ));
  };
  Renting.hook('afterUpdate', (renting, opts) =>
    Renting.handleAfterUpdate(renting, opts)
  );

};
