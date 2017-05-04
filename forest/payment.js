const Liana   = require('forest-express-sequelize');

Liana.collection('Payment', {
  actions: [{
    name: 'Refund',
    fields: [{
        field: 'amount',
        type: 'Number',
      },{
        field: 'reason',
        type: 'String',
      },
    ],
  }],
});
