const Promise = require('bluebird');
const Liana   = require('forest-express-sequelize');
const Utils   = require('../../utils');

module.exports = function(app, models, OrderItem) {
  const LEA = Liana.ensureAuthenticated;

  app.post('/forest/actions/add-discount', LEA, (req, res) => {
    const {ids, values} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple discounts');
        }

        return OrderItem.findById(ids[0]);
      })
      .then((orderItem) => {
        return orderItem.createDiscount(100 * values.discount);
      })
      .then(() => {
        return res.status(200).send({success: 'Discount created'});
      })
      .catch(Utils.logAndSend(res));
  });

  Utils.addRestoreAndDestroyRoutes(app, OrderItem);
};
