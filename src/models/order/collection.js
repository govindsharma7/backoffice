const { TRASH_SEGMENTS }  = require('../../const');
const {
  WEBSITE_URL,
  INVOICENINJA_URL,
}                         = require('../../config');
const Utils               = require('../../utils');

module.exports = function({ Order, Metadata, Payment }) {
  const getCalculatedProps = Utils.methodMemoizer({
    model: Order,
    method: 'getCalculatedProps',
  });

  return {
    fields: [{
      field: 'amount',
      type: 'Number',
      get(object) {
        return getCalculatedProps(object)
          .then(({ amount }) => amount);
      },
    }, {
      field: 'totalPaid',
      type: 'Number',
      get(object) {
        return getCalculatedProps(object)
          .then(({ totalPaid }) => totalPaid);
      },
    }, {
      field: 'balance',
      type: 'Number',
      get(object) {
        return getCalculatedProps(object)
          .then(({ balance }) => balance);
      },
    }, {
      field: 'totalRefund',
      type: 'Number',
      get(object) {
        return getCalculatedProps(object)
          .then(({ totalRefund }) => totalRefund);
      },
    }, {
      field: 'paymentPage',
      type: 'String',
      get({ id }) {
        return `${WEBSITE_URL}/en-US/payment/${id}`;
      },
    }, {
      field: 'isPaid',
      type: 'Enum',
      enums: ['pending', 'Paid'],
      get(object) {
        return object.type !== 'credit' ?
        getCalculatedProps(object)
          .then((result) => {
            return result.balance >= 0 ? 'Paid' : 'pending';
        }) : null;
      },
    }, {
      field: 'ninjaInvoice',
      type: 'String',
      get(object) {
        if (object.ninjaId !== null) {
          return `${INVOICENINJA_URL}/invoices/${object.ninjaId}/edit`;
        }

        return null;
      },
    }, {
      field: 'Refunds',
      type: ['String'],
      reference: 'Credit.id',
    }, {
      field: 'isSent',
      type: 'Enum',
      enums: ['pending', 'Sent'],
      get(object) {
        return Metadata.count({
          where: { MetadatableId: object.id, name: 'messageId' },
        })
        .then((count) => count > 0 ? 'Sent' : 'pending');
      },
    }],
    actions: [/*{
      name: 'Generate Invoice',
    }, */{
      name: 'Cancel Order',
    }, {
      name: 'Send Payment Request',
    }],
    segments: TRASH_SEGMENTS.concat({
      name: 'NoPayment',
      where: () => {
        return Order.findAll({
          where: {
            'status': 'active',
            'type': 'debit',
            '$Payments.id$': null,
          },
          include: [{ model: Payment, attributes: ['id'] }],
        })
        .reduce((acc, curr) => {
          acc.id.push(curr.id);
          return acc;
        }, { id: [] });
      },
    }, {
      name: 'HasPayment',
      where: () => {
        return Order.findAll({
          where: {
            'status': 'active',
            'type': 'debit',
            '$Payments.id$': { $not: null },
          },
          include: [{ model: Payment, attributes: ['id'] }],
        })
        .reduce((acc, curr) => {
          acc.id.push(curr.id);
          return acc;
        }, { id: [] });
      },
    }),
  };
};
