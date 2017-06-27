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
  }],
};
