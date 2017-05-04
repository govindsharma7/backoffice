const Liana = require('forest-express-sequelize');

Liana.collection('Client', {
  fields: [{
    field: 'Invoices',
    type: ['String'],
    reference: 'Invoice.id',
  }],
  actions:[{
    name: 'Credit client',
    fields: [{
        field: 'cardHolder',
        type: 'String',
      },{
        field: 'cardNumber',
        type: 'Number',
      },{
        field: 'expirationMonth',
        type: 'Enum',
        enums: ['01','02','03','04','05','06','07','08','09','10','11','12'],
      },{
        field: 'expirationYear',
        type: 'Enum',
        enums: ['2017', '2018', '2019', '2020', '2021' , '2022', '2023', '2024', '2025'],
      },{
        field: 'cvv',
        type: 'Number',
      },{
        field: 'cardType',
        type: 'Enum',
        enums: ['MasterCard', 'Visa'],
      },{
        field: 'amount',
        type: 'Number',
      },{
        field: 'reason',
        type: 'String',
      },{
        field: 'orderLabel',
        type: 'String',
      },
    ],
  }],
});
