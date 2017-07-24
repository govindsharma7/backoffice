const models = require('../src/models');

const modelsName = ['Client', 'Renting', 'Order', 'OrderItem', 'Apartment',
                    'Room', 'Payment', 'Product', 'Credit'];

modelsName.forEach((modelName) => {
  models[modelName].findAll({
    where: {
      status: 'draft',
    },
    paranoid: false,
  })
  .map((instance) => {
    return instance.restore();
  });
});
