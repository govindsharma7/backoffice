const _                   = require('lodash');
const Op                  = require('../../operators');
const { TRASH_SEGMENTS }  = require('../../const');
const {
  REST_API_URL,
  WEBSITE_URL,
}                         = require('../../config');
const Utils               = require('../../utils');

module.exports = function({ Order, Metadata }) {
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
      field: 'invoiceLink',
      type: 'String',
      get({ id, label }) {
        const path = `${REST_API_URL}/forest/actions/pdf-invoice/`;

        return `${path}${_.kebabCase(label)}.pdf?orderId=${id}&lang=fr-FR`;
      },
    }, {
      field: 'isPaid',
      type: 'Enum',
      enums: ['pending', 'Paid'],
      get(object) {
        return object.type !== 'credit' ?
        getCalculatedProps(object)
          .then((result) => result.balance >= 0 ? 'Paid' : 'pending') : null;
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
    actions: [{
      name: 'Cancel Order',
    }, {
      name: 'Send Payment Request',
    }, {
      name: 'Generate Invoice',
    }, {
      name: 'Download Invoice',
    }],
    segments: TRASH_SEGMENTS.concat({
      name: 'NoPayment',
      scope: 'totalPaid',
      where: {
        status: 'active',
        ClientId: { [Op.not]: 'maintenance' },
        [Op.or]: [
          { '$TotalPaid.totalPaid$': 0 },
          { '$TotalPaid.totalPaid$': null },
        ],
      },
    }, {
      name: 'Late Rent',
      scope: 'lateRent',
    }),
  };
};
