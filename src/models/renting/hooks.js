const Promise                     = require('bluebird');
const Sendinblue                  = require('../../vendor/sendinblue');
const Wordpress                   = require('../../vendor/wordpress');
const { NODE_ENV }                = require('../../config');

module.exports = function({ Renting, Room, Apartment, Order, Client, OrderItem }) {
  // When a renting is created or updated, verify:
  // - that the bookingDate is valid
  Renting.handleBeforeValidate = async (_renting) => {
    if ( !_renting.changed('bookingDate') ) {
      return true;
    }

    // we always need the RoomId and ClientId in the handler
    const renting =
      await ( _renting.RoomId && _renting.ClientId ? _renting : _renting.reload() );
    const { availableAt, Rentings, name } =
      await Room.scope('availableAt').findById(renting.RoomId);

    if ( availableAt == null && Rentings[0].ClientId !== _renting.ClientId ) {
      throw new Error(`Room "${name}" is already booked`);
    }

    return true;
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

    return renting.initializePriceAndFees({ room, apartment: room.Apartment });
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
    const fns = [
      () => Sendinblue.sendBookingSummaryEmail({
        client,
        renting,
        apartment,
        transaction,
      }),
      // () => renting.createQuoteOrders({
      //   packLevel,
      //   discount: discount * 100,
      //   room,
      //   apartment,
      //   transaction,
      // }),
    ];
    // sqlite doesn't like it when there's too much concurrency in a hook
    const concurrency = /^(test|dev)/.test(NODE_ENV) ? 1 : 2;

    await Promise.map(fns, (fn) => fn(), { concurrency });

    return _renting;
  };
  Renting.hook('afterCreate', (renting, opts) =>
    Renting.handleAfterCreate(renting, opts)
  );

  // When a renting is updated to active:
  // - Make sure the client is active
  // - Make sure related orders are active
  // - Send a welcomeEmail
  // - Mark the room unavailable in WordPress
  Renting.handleAfterUpdate = function(_renting, { transaction }) {
    if ( !_renting.changed('status') || _renting.status !== 'active' ) {
      return Promise.resolve(true);
    }

    return Renting.handleAfterActivate(_renting, { transaction });
  };

  Renting.handleAfterActivate = async function(_renting, { transaction }) {
    const [renting, orders] = await Promise.all([
      Renting.scope('room+apartment')
        .findById(_renting.id, { include: [{ model: Client }], transaction }),
      Order.findAll({
        where: { status: { $not: 'cancelled' } },
        include: [{
          model: OrderItem,
          where: { RentingId: _renting.id },
        }],
        transaction,
      }),
    ]);
    const { Client: client, Room: room } = renting;
    const rentOrder = orders.find(({ OrderItems }) => (
      OrderItems.some(({ ProductId }) => ( ProductId === 'rent' ))
    ));
    const depositOrder = orders.find(({ OrderItems }) => (
      OrderItems.some(({ ProductId }) => ( /-deposit$/.test(ProductId) ))
    ));

    if ( !rentOrder || !depositOrder ) {
      return Promise.resolve(true);
    }

    const depositRentItemsIds =
      [].concat(rentOrder.OrderItems, depositOrder.OrderItems)
        .map(({ id }) => id)
        .reduce((acc, curr) => acc.concat(curr), []);
    const packLevel =
      orders
        .map(({ OrderItems }) => OrderItems)
        .reduce((acc, curr) => acc.concat(curr), [])
        .find(({ ProductId }) => ( /-pack$/.test(ProductId) ))
        .ProductId.replace('-pack', '');

    return Promise.all([
      // Bulk update won't trigger Client update hooks
      Client.update({ status: 'active' }, {
        where: { id: renting.ClientId },
        transaction,
      }),
      // Bulk update won't trigger Order update hooks
      Order.update({ status: 'active' }, {
        where: { id: { $in: [rentOrder.id, depositOrder.id] } },
        transaction,
      }),
      // Bulk update won't trigger OrderItem update hooks
      OrderItem.update({ status: 'active' }, {
        where: { id: { $in: depositRentItemsIds } },
        transaction,
      }),
      Wordpress.makeRoomUnavailable({ room }),
      Sendinblue.sendWelcomeEmail({
        rentOrder,
        depositOrder,
        client,
        renting,
        room,
        apartment: room.Apartment,
        packLevel,
        transaction,
      }),
    ]);
  };
  Renting.hook('afterUpdate', (renting, opts) =>
    Renting.handleAfterUpdate(renting, opts)
);

  // It is safe to disable subqueries because it was used only with the default
  // segment which includes Events through the checkoutDate scope.
  // In this case, only a single event is ever returned.
  Renting.hook('beforeFind', (options) => {
    if ( options.subQuery === true ) {
      // Subqueries fail completely when using checkoutDate scope.
      console.warning('Sequelize subqueries have been disabled for Renting');
    }
    options.subQuery = false;
  });
};
