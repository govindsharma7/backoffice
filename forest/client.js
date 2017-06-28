const Liana          = require('forest-express-sequelize');
const {
  TRASH_SEGMENTS,
  INVOICENINJA_URL,
}                    = require('../src/const');

Liana.collection('Client', {
  fields: [{
    field: 'Full Name',
    type: 'String',
    get(object) {
      return `${object.firstName} ${object.lastName}`;
    },
  }, {
    field: 'ninja',
    type: 'String',
    get(object) {
      if (object.ninjaId !== null) {
        return `${INVOICENINJA_URL}/clients/${object.ninjaId}`;
      }

      return null;
    },
  }, {
    field: 'Invoices',
    type: ['String'],
    reference: 'Invoice.id',
  }, {
    field: 'draft-rentings',
    type: ['String'],
    reference: 'Renting.id',
  }],
  actions:[{
    name: 'Credit Client',
    fields: [{
        field: 'cardHolder',
        type: 'String',
        description: 'required',
      }, {
        field: 'cardNumber',
        type: 'Number',
        description: 'required',
      }, {
        field: 'expirationMonth',
        type: 'Enum',
        enums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
        description: 'required',
      }, {
        field: 'expirationYear',
        type: 'Enum',
        enums: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
        description: 'required',
      }, {
        field: 'cvv',
        type: 'Number',
        description: 'required',
      }, {
        field: 'cardType',
        type: 'Enum',
        enums: ['MasterCard', 'Visa'],
        description: 'required',
      }, {
        field: 'amount',
        type: 'Number',
        description: 'required',
      }, {
        field: 'reason',
        type: 'String',
      }, {
        field: 'orderLabel',
        type: 'String',
      },
    ],
  }, {
    name: 'Generate Lease',
  }, {
    name: 'Create Rent Order',
    fields: [{
      field: 'for',
      type: 'Enum',
      enums: ['current month', 'next month'],
    }],
  }, {
    name: 'Restore Client',
  }, {
    name: 'Destroy Client',
  }],
  segments: TRASH_SEGMENTS,
});
