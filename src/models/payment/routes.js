const Liana           = require('forest-express-sequelize');
const { wrap }        = require('express-promise-wrap');
const pick            = require('lodash/pick');
const { CNError }     = require('../../utils');
const Utils           = require('../../utils');
const makePublic      = require('../../middlewares/makePublic');

const _ = { pick };

module.exports = function(app, { Payment, Room, Order, OrderItem, Renting }) {
  const LEA = Liana.ensureAuthenticated;

  app.post('/forest/actions/refund', LEA, wrap(async (req, res) => {
    const { values, ids } = req.body.data.attributes;

    if (!values.amount) {
      throw new CNError('Please specify an amount');
    }
    if (ids.length > 1) {
      throw new CNError('Can\'t refund multiple payments');
    }

    values.amount *= 100;

    await Payment.refund(ids[0], values);

    return res.send({success: 'Payment Successfully Refund'});
  }));

  Payment.handleCreatePaymentRoute = async ({ body, body: { orderId } }, res) => {
    const card =
      _.pick(body, 'cardNumber,holderName,expiryMonth,expiryYear,cvv'.split(','));
    const order =
      await Order.findById(orderId, {
        include: [{
          model: OrderItem,
          include: [{
            model: Renting,
            required: false,
            attributes: ['RoomId'],
          }],
        }],
      });

    if ( !order ) {
      throw new CNError(`Order ${orderId} not found`, {
        code: 'payment.orderNotFound',
      });
    }

    // Reject payments associated with a room completely unavailable
    const packItem =
      order.OrderItems.find(({ ProductId }) => /-pack$/.test(ProductId));

    if ( packItem ) {
      const roomId = packItem.Renting.RoomId;
      const room = await Room.scope('availableAt').findById(roomId);

      if ( room.availableAt == null ) {
        throw new CNError(`Room ${roomId} is no longer available`, {
          code: 'payment.roomUnavailable',
        });
      }
    }

    const { balance } = await order.getCalculatedProps();

    // Always make sure the balance displayed on the client side is up-to-date
    // TODO the first assertion is for backward compat. Remove it in a bit.
    if ( 'balance' in body && balance !== body.balance ) {
      throw new CNError('Balance received doesn\'t match order balance', {
        code: 'payment.balanceMismatch',
      });
    }

    const { transactionId } = await order.pay({ balance, card });

    return res.send({ paymentId: transactionId });
  };
  app.post('/forest/actions/public/create-payment', makePublic, wrap(
    Payment.handleCreatePaymentRoute
  ));

  Utils.addRestoreAndDestroyRoutes(app, Payment);
};
