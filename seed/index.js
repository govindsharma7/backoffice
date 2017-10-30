// /!\ Values in this file will be <findOrCreate>d on each deploy
// All records in this file need an `id`
module.exports = {
  Setting: [{
    id: 'invoice-counter',
    type: 'int',
    value: 3773,
  }],
  Product: [{
    id: 'service-fees',
    name: 'Service Fees',
  }, {
    id: 'rent',
    name: 'Rent',
  }, {
    id: 'basic-pack',
    name: 'Basic Pack',
  }, {
    id: 'comfort-pack',
    name: 'Comfort Pack',
  }, {
    id: 'privilege-pack',
    name: 'Privilege Pack',
  }, {
    id: 'special-checkin',
    name: 'Special Checkin',
  }, {
    id: 'special-checkout',
    name: 'Special Checkout',
  }, {
    id: 'late-notice',
    name: 'Late Notice',
  }, {
    id: 'room-switch',
    name: 'Room Switch',
  }, {
    id: 'late-fees',
    name: 'Late fees',
  }, {
    id: 'lyon-deposit',
    name: 'Lyon deposit',
  }, {
    id: 'montpellier-deposit',
    name: 'Montpellier deposit',
  }, {
    id: 'paris-deposit',
    name: 'Paris deposit',
  }, {
    id: 'uncashed-deposit',
    name: 'Uncashed Deposit',
  }, {
    id: 'service-overcharging-fees',
    name: 'Service Overcharging Fees',
  }, {
    id: 'discount',
    name: 'Discount',
  }, {
    id: 'other',
    name: 'Other',
  }],
  Client: [{
    id: 'maintenance',
    firstName: 'Chez',
    lastName: 'Nestor',
    email: 'support@chez-nestor.com',
    status: 'draft',
    phoneNumber: '0000000',
  }],
  District: [{
    id: 'lyon-ainay',
    label: 'Ainay - Presqu\'île',
  }, {
    id: 'lyon-confluence',
    label: 'Confluence - Presqu\'île',
  }, {
    id: 'lyon-bellecour',
    label: 'Bellecour - Presqu\'île',
  }, {
    id: 'lyon-hotel-de-ville',
    label: 'Hôtel de Ville - Presqu\'île',
  }, {
    id: 'lyon-croix-rousse',
    label: 'Croix Rousse',
  }, {
    id: 'lyon-tete-dor',
    label: 'Tête d\'Or',
  }, {
    id: 'lyon-brotteaux',
    label: 'Brotteaux',
  }, {
    id: 'lyon-foch',
    label: 'Foch',
  }, {
    id: 'lyon-part-dieu',
    label: 'Part Dieu',
  }, {
    id: 'lyon-manufacture',
    label: 'Manufacture',
  }, {
    id: 'lyon-prefecture',
    label: 'Prefecture',
  }, {
    id: 'lyon-quais-de-rhone',
    label: 'Quais de Rhône',
  }, {
    id: 'lyon-guillotiere',
    label: 'Guillotière',
  }, {
    id: 'lyon-universites',
    label: 'Universités',
  }, {
    id: 'lyon-jean-mace',
    label: 'Jean Macé',
  }, {
    id: 'lyon-garibaldi',
    label: 'Garibaldi',
  }, {
    id: 'lyon-jet-deau',
    label: 'Jet d\'Eau',
  }, {
    id: 'lyon-debourg-gerland',
    label: 'Debourg - Gerland',
  }, {
    id: 'lyon-vieux-lyon',
    label: 'Vieux Lyon',
  }, {
    id: 'lyon-vaise',
    label: 'Vaise',
  }, {
    id: 'lyon-monchat',
    label: 'Monchat',
  }],
};
