jest.mock('../../../src/vendor/gmaps');

const D         = require('date-fns');
const app       = require('express')();
const fixtures  = require('../../../__fixtures__');
const models    = require('../../../src/models');

const { Apartment, Room, Renting } = models;

describe('Apartment - Routes', () => {
  // Initialize methods in route file
  Apartment.routes(app, models);

  describe('/maintenance-period', () => {
    it('should create a special renting for all rooms in an apartment', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room1'),
          ApartmentId: u.id('apartment'),
        }, {
          id: u.id('room2'),
          ApartmentId: u.id('apartment'),
        }],
      }))();

      await Apartment.handleMaintenancePeriodRoute({
        values: { from: D.parse('2016-01-01') },
        ids: [u.id('apartment')],
        'collection_name': 'Apartment',
      });

      const actual = await models.Room.findAll({
        where: { ApartmentId: u.id('apartment') },
        include: [{
          model: models.Renting,
          include: [models.OrderItem],
        }],
      });

      expect(actual.length).toEqual(2);
      // All rooms have a single renting
      expect(actual.every(({ Rentings }) =>
        Rentings.length === 1
      )).toEqual(true);
      // This single renting is for the client 'maintenance' and no OrderItems
      // are associated
      expect(actual.every(({ Rentings: [{ ClientId, OrderItems }] }) =>
        ClientId === 'maintenance' && OrderItems.length === 0
      )).toEqual(true);
    });

    it('should create a special renting for a single room', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room1'),
          ApartmentId: u.id('apartment'),
        }, {
          id: u.id('room2'),
          ApartmentId: u.id('apartment'),
        }],
      }))();

      await Apartment.handleMaintenancePeriodRoute({
        values: { from: D.parse('2016-01-01') },
        ids: [u.id('room2')],
        'collection_name': 'Room',
      });

      const actual = await models.Room.findAll({
        where: { ApartmentId: u.id('apartment') },
        include: [{
          model: models.Renting,
          required: true,
          include: [models.OrderItem, models.Event],
        }],
      });

      expect(actual.length).toEqual(1);
      expect(actual[0].Rentings.length).toEqual(1);
      expect(actual[0].Rentings[0].RoomId).toEqual(u.id('room2'));
      expect(actual[0].Rentings[0].ClientId).toEqual('maintenance');
      expect(actual[0].Rentings[0].OrderItems.length).toEqual(0);
      expect(actual[0].Rentings[0].Events.length).toEqual(0);
    });

    it('should create a special renting and checkout event for a room', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
      }))();

      await Apartment.handleMaintenancePeriodRoute({
        values: { from: D.parse('2016-01-01 Z'), to: D.parse('2017-07-23 Z') },
        ids: [u.id('room')],
        'collection_name': 'Room',
      });

      const actual = await models.Room.findAll({
        where: { ApartmentId: u.id('apartment') },
        include: [{
          model: models.Renting,
          required: true,
          include: [models.OrderItem, models.Event],
        }],
      });

      expect(actual.length).toEqual(1);
      expect(actual[0].Rentings.length).toEqual(1);
      expect(actual[0].Rentings[0].RoomId).toEqual(u.id('room'));
      expect(actual[0].Rentings[0].ClientId).toEqual('maintenance');
      expect(actual[0].Rentings[0].OrderItems.length).toEqual(0);
      expect(actual[0].Rentings[0].Events.length).toEqual(1);
      expect(actual[0].Rentings[0].Events[0].type).toEqual('checkout');
      expect(actual[0].Rentings[0].Events[0].startDate).toEqual(D.parse('2017-07-23 Z'));
    });
  });

  describe('/archive-accomodation', () => {
    it('should delete all rooms', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room1'),
          ApartmentId: u.id('apartment'),
        }, {
          id: u.id('room2'),
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
          status: 'draft',
          bookingDate: D.parse('2016-01-01 Z'),
          ClientId: u.id('client'),
          RoomId: u.id('room1'),
        }],
      }))();

      await Apartment.handleArchiveRoomsRoute({
        ids: [u.id('apartment')],
        'collection_name': 'Apartment',
      });

      const rooms = await Room.findAll({ where: {
        ApartmentId: u.id('apartment'),
        deletedAt: null, // during the tests, instances are destroyed in the future :-/
      } });
      const renting = await Renting.findById(u.id('renting'));

      expect(rooms.length).toEqual(0);
      expect(renting.RoomId).toEqual(u.id('room1'));
    });
  });
});
