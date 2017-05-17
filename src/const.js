const config   = require('./config');

module.exports = {
  TRASH_SEGMENTS: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
  TRASH_SCOPES: {
    trashed: {
      where: {
        deletedAt: { $not: null },
        status: { $ne: 'draft'},
      },
      paranoid: false,
    },
    draft: {
      where: {
        deletedAt: { $not: null },
        status: 'draft',
      },
      paranoid: false,
    },
  },

  INVOICENINJA_URL:
    `${config.INVOICENINJA_PROTOCOL || 'http'}://${config.INVOICENINJA_HOST}`,

  BASIC_PACK: 'basic',
  COMFORT_PACK: 'comfort',
  PRIVILEGE_PACK: 'privilege',
  PACK_PRICES: {
    lyon: {
      basic: 59000,
      comfort: 79000,
      privilege: 99000,
    },
    montpellier: {
      basic: 39000,
      comfort: 59000,
      privilege: 79000,
    },
    paris: {
      basic: 79000,
      comfort: 99000,
      privilege: 119000,
    },
  },

  SPECIAL_CHECKIN_PRICE: 7500,

  SERVICE_FEES: {
    1: 5000, // 1 room
    2: 4000, // 2 rooms
    default: 3000, // 3 or more rooms
  },

  RENT_COEFS: [
    null, // D.format returns '1' for the first day of the year, not 0.
    0.95,
    0.96,
    0.95,
    0.96,
    0.95,
    0.96,
    0.95,
    0.96,
    0.95,
    0.96,
    0.95,
    0.96,
    0.95,
    0.96,
    0.95,
    0.94,
    0.93,
    0.92,
    0.91,
    0.90,
    0.89,
    0.88,
    0.87,
    0.86,
    0.85,
    0.86,
    0.85,
    0.86,
    0.85,
    0.86,
    0.85,
    0.86,
    0.85,
    0.86,
    0.85,
    0.85,
    0.84,
    0.84,
    0.83,
    0.83,
    0.82,
    0.82,
    0.81,
    0.81,
    0.80,
    0.80,
    0.79,
    0.79,
    0.78,
    0.78,
    0.77,
    0.77,
    0.76,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.76,
    0.75,
    0.75,
    0.76,
    0.76,
    0.76,
    0.77,
    0.77,
    0.77,
    0.78,
    0.78,
    0.78,
    0.79,
    0.79,
    0.79,
    0.80,
    0.80,
    0.80,
    0.81,
    0.81,
    0.81,
    0.82,
    0.82,
    0.82,
    0.83,
    0.83,
    0.83,
    0.84,
    0.84,
    0.84,
    0.85,
    0.85,
    0.85,
    0.86,
    0.86,
    0.86,
    0.87,
    0.87,
    0.87,
    0.88,
    0.88,
    0.88,
    0.89,
    0.89,
    0.89,
    0.90,
    0.90,
    0.90,
    0.91,
    0.91,
    0.91,
    0.92,
    0.92,
    0.92,
    0.93,
    0.93,
    0.93,
    0.94,
    0.94,
    0.94,
    0.95,
    0.95,
    0.95,
    0.96,
    0.96,
    0.96,
    0.97,
    0.97,
    0.97,
    0.98,
    0.98,
    0.98,
    0.99,
    0.99,
    0.99,
    1,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    0.99,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0.99,
    0.99,
    0.98,
    0.98,
    0.97,
    0.97,
    0.96,
    0.96,
    0.95,
    0.95,
    0.94,
    0.94,
    0.93,
    0.93,
    0.92,
    0.92,
    0.91,
    0.91,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.90,
    0.91,
    0.92,
    0.93,
    0.94,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
    0.95,
  ],
};
