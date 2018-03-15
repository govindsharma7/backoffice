jest.mock('../../../src/vendor/zapier');

const Promise               = require('bluebird');
const D                     = require('date-fns');
const fixtures              = require('../../../__fixtures__');
const models                = require('../../../src/models');
const Utils                 = require('../../../src/utils');
const Sendinblue            = require('../../../src/vendor/sendinblue');
const Zapier                = require('../../../src/vendor/zapier');

describe('Payment - Hooks', () => {
  describe('afterCreate', () => {
    it('should send a payment confirmation after create', async () => {
      const spiedPost = jest.spyOn(Zapier, 'post');
      const spiedSendTemplate = jest.spyOn(Sendinblue, 'sendTemplateEmail');
      const spiedFormat = jest.spyOn(D, 'format');

      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `${u.id('client')}@test.com`,
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          ClientId: u.id('client'),
          status: 'draft',
        }],
      }))();

      // Without this the snapshot will be different locally and on the CI server
      spiedFormat
        .mockImplementationOnce(() => '02/01/2017')
        .mockImplementationOnce(() => '10:10');

      await models.Payment.create({
        type: 'card',
        amount: 12300,
        OrderId: u.id('order'),
      });

      spiedFormat.mockClear()

      const order = await models.Order.findById(u.id('order'), {
        include: [models.Metadata],
      });

      expect(order.pickReceiptNumber).not.toEqual(null);
      expect(order.status).toEqual('active');
      expect(order.Metadata.length).toEqual(1);
      expect(order.Metadata[0].name).toEqual('messageId');
      expect(Utils.snapshotableLastCall(spiedSendTemplate))
        .toMatchSnapshot();
      expect(Utils.snapshotableLastCall(spiedPost))
        .toMatchSnapshot();
    });
  });

  describe('beforeDelete, beforeUpdate', () => {
    it('should prevent non-manual payments to be updated or deleted', () =>
      fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          status: 'active',
          ClientId: u.id('client'),
        }],
        Payment: [{
          id: u.id('cardPayment'),
          type: 'card',
          amount: 10000,
          OrderId: u.id('order'),
        }, {
          id: u.id('manualPayment'),
          type: 'manual',
          amount: 10000,
          OrderId: u.id('order'),
        }],
      }))({ method: 'create', hooks: false })
      .tap(({ instances: { cardPayment, manualPayment } }) => Promise.all([
        expect(cardPayment.update({ amount: 20000 }))
          .rejects.toThrowErrorMatchingSnapshot(),
        expect(manualPayment.update({ amount: 20000 }))
          .resolves.toEqual(expect.objectContaining({ amount: 20000 })),
      ]))
      .tap(({ instances: { cardPayment, manualPayment } }) => Promise.all([
        expect(cardPayment.destroy())
          .rejects.toThrowErrorMatchingSnapshot(),
        expect(manualPayment.destroy())
          .resolves.toEqual(expect.anything()),
      ]))
    );
  });
});
