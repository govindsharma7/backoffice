#!/usr/bin/env node

const Ninja   = require('../src/vendor/invoiceninja');
const models  = require('../src/models');

const {Order} = models;


return Order.scope('rentOrdersProrate')
  .findAll()
  .then((orders) => {
    return orders.map((order) => {
      const {ninjaId} = order;
      const {Renting} = order.OrderItems[0];

      /*eslint-disable promise/no-nesting */
      return Ninja.invoice.getInvoice({
        'invoice_id' : ninjaId,
      })
      .then((response) => {
        const {data} = response.obj;

        if ( data.invoice_status_id === Ninja.INVOICE_STATUS_PARTIAL ||
            data.invoice_status_id === Ninja.INVOICE_STATUS_PAID ) {
          throw new Error('This invoice has been paid or partially paid');
        }

        return models.Renting.update({
          bookingDate: Date.now(),
        }, {
          where: {
            id: Renting.id,
          },
        });
      })
      .then(() => {
        return Renting.prorate(Date.now());
      })
      .then(({price, serviceFees}) => {
        if ( price !== null ) {
          models.OrderItem.update({
            unitPrice: price,
          }, {
            where: {
              RentingId: Renting.id,
              OrderId: order.id,
              ProductId: 'rent',
            },
          });
        }
        if ( serviceFees !== null) {
          models.OrderItem.update({
            unitPrice: serviceFees,
          }, {
            where: {
              RentingId: Renting.id,
              OrderId: order.id,
              ProductId: 'service-fees',
            },
          });
        }
        return true;
      })
      .catch((err) => {
        console.log(err);
      });
    /*eslint-disable promise/no-nesting */
    });
  });
