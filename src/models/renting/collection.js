const {
  BASIC_PACK,
  COMFORT_PACK,
  PRIVILEGE_PACK,
  TRASH_SEGMENTS,
}                 = require('../../const');
const Utils       = require('../../utils');

module.exports = function(models) {
  return {
    fields: [{
      field: 'booking date coef',
      type: 'Number',
      get(object) {
        return Utils.getPeriodCoef(object.bookingDate);
      },
    }, {
      field: 'current status',
      type: 'Enum',
      enums: ['current',
              'past',
              'future',
              'draft'],
      get(object) {
        return models.Renting.scope('checkoutDate')
          .findById(object.id)
          .then((renting) => {
            if ( renting.get('checkoutDate') &&
                renting.get('checkoutDate') < Date.now() ) {
              return 'past';
            }
            else if ( renting.status === 'draft' ) {
              return 'draft';
            }
            else if ( renting.bookingDate > Date.now() ) {
              return 'future';
            }
            else if ( renting.bookingDate < Date.now() &&
                (renting.get('checkoutDate') == null ||
                 renting.get('checkoutDate') > Date.now()) ) {
              return 'current';
            }
            return null;
          });
      },
    }],
    actions:[{
      name: 'Create First Rent Order',
    }, {
      name: 'Create Pack Order',
      fields: [{
        field: 'comfortLevel',
        type: 'Enum',
        enums: [BASIC_PACK, COMFORT_PACK, PRIVILEGE_PACK],
      }, {
        field: 'discount',
        type: 'Number',
      }],
    }, {
      name: 'Create Deposit Order',
    }, {
      name: 'Create Quote Orders',
      fields: [{
        field: 'comfortLevel',
        type: 'Enum',
        enums: [BASIC_PACK, COMFORT_PACK, PRIVILEGE_PACK],
      }, {
        field: 'packDiscount',
        type: 'Number',
      }],
    }, {
      name: 'Update "do not cash deposit" Option',
      fields: [{
        field: 'option',
        description: 'required',
        type: 'Enum',
        enums: ['cash deposit', 'do not cash deposit'],
      }],
    }, {
      name: 'Add Checkin Date',
      fields: [{
        field: 'dateAndTime',
        type: 'Date',
      }],
    }, {
      name: 'Add Checkout Date',
      fields :[{
        field: 'dateAndTime',
        type: 'Date',
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
      name: 'Restore Renting',
    }, {
      name: 'Destroy Renting',
    }],
    segments : TRASH_SEGMENTS,
  };
};
