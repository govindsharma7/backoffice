const Promise       = require('bluebird');
const fixtures      = require('../../../__fixtures__');
const models        = require('../../../src/models');

const { Order, Renting } = models;

describe('hooks:afterUpdate', () => {
  it('shouldn\'t do anything unless status is updated to active', async () => {
    const { instances: { order } } = await fixtures((u) => ({
      Client: [{
        id: u.id('client'),
        firstName: 'John',
        lastName: 'Doe',
        email: `john-${u.int(1)}@doe.something`,
        status: 'draft',
      }],
      Order: [{
        id: u.id('order'),
        label: 'A random order',
        ClientId: u.id('client'),
        status: 'draft',
      }],
    }))({ method: 'create', hooks: 'Order' });

    const updated = await order.update({ status: 'cancelled' }, { hooks: false });
    const actual = await Order.handleAfterUpdate(updated, {});

    expect(actual).toEqual(true);
  });

  it('should make the items and renting active when it becomes active', () => {
    const { handleAfterActivate: afterRentingUpdate } = Renting;

    Renting.handleAfterActivate = jest.fn(() => true);

    return fixtures((u) => ({
      Client: [{
        id: u.id('client'),
        firstName: 'John',
        lastName: 'Doe',
        email: `john-${u.int(1)}@doe.something`,
        status: 'draft',
      }],
      Order: [{
        id: u.id('order'),
        label: 'A random order',
        ClientId: u.id('client'),
        status: 'draft',
      }],
      District: [{ id: u.id('district') }],
      Apartment: [{ id: u.id('apartment'), DistrictId: u.id('district') }],
      Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
      Renting: [{
        id: u.id('renting'),
        ClientId: u.id('client'),
        RoomId: u.id('room'),
        status: 'draft',
      }],
      OrderItem: [{
        id: u.id('item'),
        label: 'A random order',
        OrderId: u.id('order'),
        RentingId: u.id('renting'),
        status: 'draft',
      }],
    }))({ method: 'create', hooks: 'Order' })
    .tap(({ instances: { order } }) => order.update({ status: 'active' }))
    .tap(Promise.delay(200))
    .then(({ instances: { item, renting } }) => Promise.all([
      expect(Renting.handleAfterActivate).toHaveBeenCalled(),
      expect(item.reload())
        .resolves.toEqual(expect.objectContaining({ status: 'active' })),
      expect(renting.reload())
        .resolves.toEqual(expect.objectContaining({ status: 'active' })),
    ]))
    .then(() => Renting.handleAfterUpdate = afterRentingUpdate);
  });
});
