#!/usr/bin/env node

const D       = require('date-fns');
const Ninja   = require('../src/vendor/invoiceninja');
const models  = require('../src/models');

const {Renting} = models;
const INVOICE_STATUS_PAID = 6;
const INVOICE_STATUS_PARTIAL = 5;

return Renting.scope('rentOrdersProrate')
  .findAll()
  .then((rentings) => {
    return rentings.filter((renting) => {
      return renting.Client.Orders.length > 0;
    })
    .map((renting) => {
      const {ninjaId} = renting.Client.Orders[0];

      /*eslint-disable promise/no-nesting */
      return Ninja.invoice.getInvoice({
        'invoice_id' : ninjaId,
      })
      .then((response) => {
        const {data} = response.obj;

        if ( data.invoice_status_id === INVOICE_STATUS_PARTIAL ||
            data.invoice_status_id === INVOICE_STATUS_PAID ) {
          return renting;
        }
        return renting.update({ bookingDate: Date.now() });
      })
      .then((renting) => {
        if ( !D.isToday(renting.bookingDate) ) {
          return {
            price: null,
            serviceFees: null,
          };
        }
        return renting.prorate(Date.now());
      })
      .then(({price, serviceFees}) => {
        if ( price !== null ) {
          models.OrderItem.update({
            unitPrice: price,
          }, {
            where: {
              RentingId: renting.id,
              ProductId: 'rent',
            },
          });
        }
        if ( serviceFees !== null) {
          models.OrderItem.update({
            unitPrice: serviceFees,
          }, {
            where: {
              RentingId: renting.id,
              ProductId: 'service-fees',
            },
          });
        }
        return true;
      });
    /*eslint-disable promise/no-nesting */
    });
  });
