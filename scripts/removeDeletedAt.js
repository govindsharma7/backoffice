const models = require('../src/models');

const modelsName = ['Client', 'Renting', 'Order', 'OrderItem', 'Apartment',
                    'Room', 'Payment', 'Product', 'Credit'];

modelsName.forEach((modelName) => {
  models[modelName].restore({
    where: { status: 'draft' },
    paranoid: false,
  });
});
