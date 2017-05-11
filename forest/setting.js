const Liana = require('forest-express-sequelize');

Liana.collection('Setting', {
  fields: [{
    field: '_value',
    type: 'String',
    get(setting) {
      return setting.value;
    },
    set(setting, value) {
      setting.value = value;
      return setting;
    },
  }],
});
