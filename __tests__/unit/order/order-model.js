jest.mock('../../../src/vendor/zapier');

const Promise       = require('bluebird');
const D             = require('date-fns');
const fixtures      = require('../../../__fixtures__');
const orderFixtures = require('../../../__fixtures__/order');
const models        = require('../../../src/models');
const Utils         = require('../../../src/utils');
const Op            = require('../../../src/operators');
const payline       = require('../../../src/vendor/payline');
const Sendinblue    = require('../../../src/vendor/sendinblue');

const { Order, Metadata, Payment } = models;

let order;
let invoiceCounter;

describe('Order', () => {
  beforeAll(() => {
    return orderFixtures()
      .then(({instances}) => {
        return (
          order = instances['order-1'],
          invoiceCounter = instances['invoice-counter']
        );
      });
  });

  describe('Scopes', () => {
    test('totalPaidRefund scope return total paid and refund for an Order', () => {
      return Order.scope('totalPaidRefund')
        .findById(order.id)
        .then((order) => {
          expect(order.get('totalPaid')).toEqual(100 + 100);
          return expect(order.get('totalRefund')).toBe(100);
        });
    });
    test('amount scope return amount of an order', () => {
      return Order.scope('amount')
        .findById(order.id)
        .then((order) => expect(order.get('amount')).toEqual(100 * 3 + 200));
    });

    describe('pendingRent', () => {
      it('finds rent orders that have no payment or 0€ payment', async () => {
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{ id: u.id('apart'), DistrictId: 'lyon-ainay' }],
          Room: [{ id: u.id('room'), ApartmentId: u.id('apart') }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
            status: 'active',
          }],
          Renting: [{ id: u.id('renting'), status: 'active' }],
          Order: [{
            id: u.id('order1'),
            label: 'A random order',
            ClientId: u.id('client'),
            status: 'draft',
            dueDate: D.parse('2016-01-01'),
          }, {
            id: u.id('order2'),
            label: 'A second random order',
            ClientId: u.id('client'),
            status: 'draft',
            dueDate: D.parse('2016-01-01'),
          }, {
            id: u.id('order3'),
            label: 'A third random order',
            ClientId: u.id('client'),
            status: 'draft',
            dueDate: D.parse('2016-01-01'),
          }, {
            id: u.id('order4'),
            label: 'A fourth random order',
            ClientId: u.id('client'),
            status: 'draft',
            dueDate: D.parse('2016-01-01'),
          }],
          OrderItem: [{
            id: u.id('item1'),
            label: 'A random item',
            OrderId: u.id('order1'),
            ProductId: 'rent',
            RentingId: u.id('renting'),
            unitPrice: 12300,
          }, {
            id: u.id('item2'),
            label: 'A second random item',
            OrderId: u.id('order1'),
            ProductId: 'service-fees',
            RentingId: u.id('renting'),
            untiPrice: 45600,
          }, {
            id: u.id('item3'),
            label: 'A third random item',
            OrderId: u.id('order2'),
            ProductId: 'rent',
            RentingId: u.id('renting'),
            unitPrice: 78900,
          }, {
            id: u.id('item4'),
            label: 'A fourth random item',
            OrderId: u.id('order3'),
            ProductId: 'rent',
            RentingId: u.id('renting'),
            unitPrice: 98700,
          }, {
            id: u.id('item5'),
            label: 'A fifth random item',
            OrderId: u.id('order4'),
            ProductId: 'rent',
            RentingId: u.id('renting'),
            unitPrice: 65400,
          }],
          Payment: [{
            id: u.id('null-payment'),
            type: 'card',
            amount: 0,
            OrderId: u.id('order1'),
          }, {
            id: u.id('incomplete-payment'),
            type: 'card',
            amount: 8900,
            OrderId: u.id('order2'),
          }, {
            id: u.id('full-payment'),
            type: 'card',
            amount: 98700,
            OrderId: u.id('order3'),
          }],
        }))();
        const now = D.addWeeks(new Date(), 2);
        const lateRents = await models.Order.scope('pendingRent').findAll({
          where: { ClientId: u.id('client') },
          dueDate: { [Op.lt]: now },
          createdAt: { [Op.lt]: D.subDays(Utils.now(), 7) },
        });
        const order1 = lateRents.find(({ id }) => id === u.id('order1'));
        const order2 = lateRents.find(({ id }) => id === u.id('order2'));
        const order4 = lateRents.find(({ id }) => id === u.id('order4'));

        expect(lateRents.length).toEqual(3);
        expect(order1.get('totalPaid')).toEqual(0);
        expect(order1.get('amount')).toEqual(12300);
        expect(order1.get('balance')).toEqual(-12300);
        expect(order2.get('totalPaid')).toEqual(8900);
        expect(order2.get('amount')).toEqual(78900);
        expect(order2.get('balance')).toEqual(-70000);
        expect(order4.get('totalPaid')).toEqual(0);
        expect(order4.get('amount')).toEqual(65400);
        expect(order4.get('balance')).toEqual(-65400);
      });
    });
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return order
        .getAmount()
        .then((amount) => expect(amount).toEqual(300 + 200));
    });
  });

  describe('#getTotalPaidAndRefund', () => {
    test('it should calculate the totalpaid and refund for one item', () => {
      return order
        .getTotalPaidAndRefund()
        .then(({totalPaid, totalRefund}) => {
          expect(totalPaid).toEqual(100 + 100);
          return expect(totalRefund).toEqual(100);
        });
    });
  });

  describe('#getCalculatedProps()', () => {
    test('it should calculate amount totalPaid and balance properties', () => {
      return order
        .getCalculatedProps()
        .then((result) => {
          return expect(result).toEqual({
            amount: 500,
            totalPaid: 200,
            totalRefund: 100,
            balance: -400,
          });
        });
    });
  });

  describe('#pickReceiptNumber', () => {
    test('it should set the order number automatically according to its type', () => {
      return Promise.all([
          invoiceCounter
            .set('value', Math.round(Math.random() * 1E12))
            .save(),
          Order.create({
            type: 'debit',
            label: 'test numbering',
          }),
        ])
        .then(([counter, order]) => Promise.all([
          counter,
          order.pickReceiptNumber(),
        ]))
        .then(([counter, order]) =>
          expect(order.receiptNumber).toEqual((counter.value + 1).toString())
        );
    });
  });

  describe('.pay', () => {
    const spiedDoPurchase = jest.spyOn(payline, 'doPurchase');
    const spiedSendTemplate = jest.spyOn(Sendinblue, 'sendTemplateEmail');
    const spiedNow = jest.spyOn(Utils, 'now');
    const card = { cardNumber: '4242424242424242' };

    it('should throw if the card type is invalid', () => {
      const actual = Order.pay({
        order: { id: Math.random() },
        balance: -100,
        card: { cardNumber: '6666666666666666' },
      });

      return expect(actual).rejects.toThrow(expect.objectContaining({
        code: 'payment.invalidCardType',
      }));
    });

    it('should throw if the order is cancelled', () => {
      const actual = Order.pay({
        order: { id: Math.random(), status: 'cancelled' },
        balance: -100,
        card,
      });

      return expect(actual).rejects.toThrow(expect.objectContaining({
        code: 'payment.orderCancelled',
      }));
    });

    it('should throw if balance is null or positive', async () => {
      const actualNull = Order.pay({
        order: { id: Math.random() },
        balance: 0,
        card,
      });
      const actualPositive = Order.pay({
        order: { id: Math.random() },
        balance: 100,
        card,
      });

      await expect(actualNull).rejects.toThrow(expect.objectContaining({
        code: 'payment.orderPaid',
      }));
      await expect(actualPositive).rejects.toThrow(expect.objectContaining({
        code: 'payment.orderPaid',
      }));

      return true;
    });

    it('should save payment attempt and error info as metadata', async () => {
      spiedDoPurchase.mockImplementationOnce(() => {
        throw new Error('Completely unexpected error');
      });

      const id = Math.random();
      const shouldThrow = Order.pay({
        order: { id, status: 'active' },
        balance: -100,
        card,
      });

      await expect(shouldThrow).rejects.toThrow();

      const metadata = await Metadata.findAll({ where: {
        metadatable: 'Order',
        MetadatableId: id,
      } });

      expect(metadata.length).toEqual(2);
      expect((metadata.some(({ name }) => name === 'paymentAttempt')))
        .toBe(true);
      expect((metadata.some(({ name }) => name === 'paymentError')))
        .toBe(true);
    });

    it('should create a payment if the purchase is successful', async () => {
      const { instances: { order } } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `${u.id('client')}@test.com`,
          status: 'active',
        }],
        Order: [{
          id: u.id('order'),
          ClientId: u.id('client'),
          status: 'active',
        }],
        OrderItem: [{
          label: 'label',
          unitPrice: 100,
          OrderId: u.id('order'),
        }],
      }))();
      const transactionId = `${Math.random()}`;
      const messageId = Math.random();

      spiedDoPurchase.mockImplementationOnce(() => ({ transactionId }));
      spiedSendTemplate.mockImplementationOnce(() => ({ messageId }));
      spiedNow.mockImplementation(() => D.parse('2017-01-02 Z'));

      await Order.pay({
        order,
        balance: -100,
        card,
      });

      spiedNow.mockClear();

      expect(Utils.snapshotableLastCall(spiedDoPurchase))
        .toMatchSnapshot();
      expect(Utils.snapshotableLastCall(spiedSendTemplate))
        .toMatchSnapshot();

      const metadata = await Metadata.findAll({ where: {
        metadatable: 'Order',
        MetadatableId: order.id,
      } });

      expect(metadata.length).toEqual(2);
      expect((metadata.some(({ name }) => name === 'paymentAttempt')))
        .toBe(true);
      expect((metadata.some(({ value }) => value.endsWith(messageId))))
        .toBe(true);

      const payment = await Payment.findOne({ where: { OrderId: order.id } });

      expect(payment.paylineId).toEqual(transactionId);
      expect(payment.amount).toEqual(100);
    });
  });
});
