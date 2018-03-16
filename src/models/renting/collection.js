const {
  BASIC_PACK,
  COMFORT_PACK,
  PRIVILEGE_PACK,
  TRASH_SEGMENTS,
}                 = require('../../const');
const Utils       = require('../../utils');
const Products    = require('../../../seed');

module.exports = function() {
  return {
    fields: [{
      field: 'booking date coef',
      type: 'Number',
      get(object) {
        return Utils.getPeriodCoef(object.bookingDate);
      },
    }, {
      field: 'Housing Pack',
      type: 'Enum',
      enums: [BASIC_PACK, COMFORT_PACK, PRIVILEGE_PACK],
      set(object, value) {
        object.packLevel = value;
        return object;
      },
    }, {
      field: 'Pack Discount',
      type: 'Number',
      set(object, value) {
        object.discount = value;
        return object;
      },
    }, {
      field: '2 occupants ?',
      type: 'Boolean',
      set(object, value) {
        object.hasTwoOccupants = value;
        return object;
      },
    }, {
      field: 'checkoutDate',
      type: 'Date',
      async get(object) {
        return (await object.requireScopes(['checkoutDate'])).checkoutDate;
      },
    }, {
      field: 'period',
      type: 'Enum',
      enums: ['current', 'past', 'future'],
      async get(object) {
        return (await object.requireScopes(['checkoutDate'])).period;
      },
    }],
    actions: [{
      name: 'Create First Rent Order',
    }, {
      name: 'Create Pack Order',
      fields: [{
        field: 'packLevel',
        type: 'Enum',
        enums: [BASIC_PACK, COMFORT_PACK, PRIVILEGE_PACK],
        isRequired: true,
      }, {
        field: 'discount',
        type: 'Number',
      }],
    }, {
      name: 'Create Deposit Order',
    }, {
      name: 'Create Quote Orders',
      fields: [{
        field: 'packLevel',
        type: 'Enum',
        enums: [BASIC_PACK, COMFORT_PACK, PRIVILEGE_PACK],
        isRequired: true,
      }, {
        field: 'discount',
        type: 'Number',
      }],
    }, {
      name: 'Update "do not cash deposit" Option',
      fields: [{
        field: 'option',
        type: 'Enum',
        isRequired: true,
        enums: ['cash deposit', 'do not cash deposit'],
      }],
    }, {
      name: 'Add Checkin Date',
      fields: [{
        field: 'dateAndTime',
        type: 'Date',
        isRequired: true,
      }],
    }, {
      name: 'Add Checkout Date',
      fields :[{
        field: 'dateAndTime',
        type: 'Date',
        isRequired: true,
      }],
    }, {
      name: 'Generate Lease',
    }, {
      name: 'Create Checkin Order',
    }, {
      name: 'Create Checkout Order',
    }, {
      name: 'Create Room Switch Order',
      fields: [{
        field: 'discount',
        type: 'Number',
      }],
    }, {
      name: 'Future Credit',
      fields: [{
        field: 'discount',
        type: 'Number',
      }, {
        field: 'label',
        type: 'String',
        isRequired: true,
      }],
    }, {
      name: 'Future Debit',
      fields: [{
        field: 'amount',
        isRequired: true,
        type: 'Number',
      }, {
        field: 'reason',
        type: 'Enum',
        isRequired: true,
        enums: Products.Product.map((product) => product.name),
      }, {
        field: 'invoiceWith',
        type: 'Enum',
        enums: ['Next Rent Invoice', 'Account Balance Invoice'],
        isRequired: true,
      }, {
        field: 'label',
        type: 'String',
        isRequired: true,
      }],
    }, {
      name: 'Restore Renting',
    }, {
      name: 'Destroy Renting',
    }],
    segments : TRASH_SEGMENTS.concat({
      name: 'default',
      scope: 'checkoutDate',
    }),
  };
};
