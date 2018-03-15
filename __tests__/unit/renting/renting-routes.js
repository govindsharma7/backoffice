jest.mock('../../../src/vendor/zapier');

const Promise                 = require('bluebird');
const D                       = require('date-fns');
const app                     = require('express')();
const fixtures                = require('../../../__fixtures__');
const models                  = require('../../../src/models');
const Utils                   = require('../../../src/utils');
const Zapier                  = require('../../../src/vendor/zapier');

const { Renting, Client, Event } = models;

describe('Renting - Routes', () => {
  const spiedPost = jest.spyOn(Zapier, 'post');

  // Initialize methods in route file
  Renting.routes(app, models);

  describe('.handleCreateClientAndRentingRoute', () => {
    it('should throw a roomUnavailable error if the room is unavailable', async () => {
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
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
      }))();
      const actual =
        Renting.handleCreateClientAndRentingRoute({ roomId: u.id('room') });

      await expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should create a client and a renting and send a booking summary', async () => {
      jest.spyOn(Client, 'handleAfterCreate').mockImplementationOnce(() => true);
      jest.spyOn(Renting, 'handleAfterCreate').mockImplementationOnce(() => true);

      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
          roomCount: 3,
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
          basePrice: 12300,
        }],
      }))();
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
      const expectedPeriodCoef = await Utils.getPeriodCoef(new Date());
      const expectedPeriodPrice =
        await Utils.getPeriodPrice( 12300, expectedPeriodCoef, 3000 );

      expect(renting.RoomId).toEqual(u.id('room'));
      expect(D.startOfDay(renting.bookingDate))
        .toEqual(D.startOfDay(new Date()));
      expect(renting.price).toEqual(expectedPeriodPrice);
      expect(renting.serviceFees).toEqual(3000);
      expect(client.email).toEqual(email);

      expect(Client.handleAfterCreate).toHaveBeenCalled();
      expect(Renting.handleAfterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          packLevel: 'comfort',
        }),
        expect.anything()
      );
    });
  });

  describe('.handleAddCheckinDateHandler', () => {
    it('should create a checkin event and send it to zapier', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
          addressStreet: '16 rue de Condé',
          addressZip: '69002',
          addressCity: 'lyon',
          addressCountry: 'France',
        }],
        Room: [{
          id: u.id('room'),
          name: 'room name',
          ApartmentId: u.id('apartment'),
        }],
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'active',
          bookingDate: D.parse('2016-01-01'),
        }],
      }))();

      await Renting.addCheckinDateHandler({
        values: { dateAndTime: D.parse('2016-01-02T12:30') },
        ids: [u.id('renting')],
      });

      await Promise.delay(200);

      const event = await Event.findOne({ where: { EventableId: u.id('renting') }});

      expect(event.startDate).toEqual(D.parse('2016-01-02T12:30'));
      expect(event.endDate).toEqual(D.parse('2016-01-02T13:00'));
      expect(event.type).toEqual('checkin');
      expect(event.summary).toEqual('checkin John DOE');
      expect(event.description).toMatchSnapshot();
      expect(event.location).toEqual('16 rue de Condé, 69002 lyon, France');
      expect(Utils.snapshotableLastCall(spiedPost))
        .toMatchSnapshot();
    });
  });
});
