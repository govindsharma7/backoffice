const D                   = require('date-fns');
const app                   = require('express')();
const fixtures            = require('../../../__fixtures__');
const models              = require('../../../src/models');

const { Renting, Client } = models;

describe('Renting - Routes', () => {
  // Initialize methods in route file
  Renting.routes(app, models);

  describe('.handleCreateClientAndRentingRoute', () => {
    it('should throw a roomUnavailable error if the room is unavailable', () =>
      fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        District: [{ id: u.id('district') }],
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: u.id('district'),
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'active',
          bookingDate: D.parse('2016-01-01'),
        }],
      }))({ method: 'create', hooks: false })
      .then(({ unique: u }) => {
        const actual =
          Renting.handleCreateClientAndRentingRoute({ roomId: u.id('room') });

        return expect(actual).rejects.toThrowErrorMatchingSnapshot();
      })
    );

    it('should create a client and a renting and send a booking summary', () => {
      const { handleAfterCreate: hacClient } = Client;
      const { handleAfterCreate: hacRenting } = Renting;

      Client.handleAfterCreate = jest.fn();
      Renting.handleAfterCreate = jest.fn();

      return fixtures((u) => ({
        District: [{ id: u.id('district') }],
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: u.id('district'),
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
      }))({ method: 'create', hooks: false })
      .then(async ({ unique: u }) => {
        const email = `john${Math.random().toString().slice(2)}@doe.fr`;
        const renting = await Renting.handleCreateClientAndRentingRoute({
          pack: 'comfort',
          booking: {
            email,
            firstName: 'John',
            lastName: 'Doe',
          },
          roomId: u.id('room'),
        });
        const client = await Client.findById(renting.ClientId);

        expect(renting.RoomId).toEqual(u.id('room'));
        expect(client.email).toEqual(email);

        expect(Client.handleAfterCreate).toHaveBeenCalled();
        expect(Renting.handleAfterCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            packLevel: 'comfort',
          }),
          expect.anything()
        );

        Client.handleAfterCreate = hacClient;
        Renting.handleAfterCreate = hacRenting;

        return true;
      });
    });
  });
});
