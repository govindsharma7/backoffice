const D                   = require('date-fns');
const fixtures            = require('../../../__fixtures__');
const models              = require('../../../src/models');

const { Renting } = models;

describe('Renting - Model', () => {

  describe('scopes', () => {
    test('checkinDate should include the checkin date', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
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
        Event: [{
          type: 'checkin',
          EventableId: u.id('renting'),
          eventable: 'Renting',
          startDate: D.parse('2017-05-14 Z'),
          endDate: D.parse('2017-05-14 Z'),
        }],
      }))({ method: 'create', hooks: false });

      const renting =
        await Renting.scope('checkinDate').findById(u.id('renting'));

      expect(renting.get('checkinDate')).toEqual(D.parse('2017-05-14 Z'));
    });
    test('checkinDate should be null when there is no checkin event', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
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
      }))({ method: 'create', hooks: false });

      const renting =
        await Renting.scope('checkinDate').findById(u.id('renting'));

      expect(renting.get('checkinDate')).toBeNull();
    });

    test('it should return the comfort level of the housing pack', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
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
        OrderItem: [{
          id: u.id('orderItem'),
          label: 'Label shouldn\'t matter',
          ProductId: 'privilege-pack',
          RentingId: u.id('renting'),
        }],
      }))({ method: 'create', hooks: false });

      const renting = await Renting.scope('packLevel').findById(u.id('renting'));

      expect(renting.get('packLevel')).toEqual('privilege');
    });
    test('it should return null when there is no housing pack', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
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
      }))({ method: 'create', hooks: false });

      const renting = await Renting.scope('packLevel').findById(u.id('renting'));

      expect(renting.get('packLevel')).toBeNull();
    });

    describe('currentRenting & latestRenting', () => {
      it('finds all currentRentings of an apartment', async () => {
        let apartment;
        const now = new Date();
        const oneYearAgo = D.subYears(now, 1);
        const oneMonthAgo = D.subMonths(now, 1);
        const oneMonthFromNow = D.addMonths(now, 1);
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
            id: u.id('draft-renting'),
            status: 'draft',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('past-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room2'),
          }, {
            id: u.id('current-renting1'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('current-renting2'),
            status: 'active',
            bookingDate: oneMonthAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room2'),
          }, {
            id: u.id('future-renting'),
            status: 'active',
            bookingDate: oneMonthFromNow,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('current-renting1'),
            eventable: 'Renting',
            startDate: oneMonthFromNow,
            endDate: oneMonthFromNow,
          }, {
            type: 'checkout',
            EventableId: u.id('past-renting'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }],
        }))({ method: 'create', hooks: false });

        apartment = await models.Apartment.findById(u.id('apartment'), {
          include: [{
            model: models.Room,
            include: [models.Renting.scope({
              method: ['latestRenting', 'Rooms->Rentings'],
              required: false,
            })],
          }],
        });

        const latestRentingsIds =
          [].concat.apply([], apartment.Rooms.map(({ Rentings }) =>
            Rentings.map(({ id }) => id))
          );

        expect(latestRentingsIds.length).toEqual(2);
        expect(latestRentingsIds).toContain(u.id('current-renting2'));
        expect(latestRentingsIds).toContain(u.id('future-renting'));

        apartment = await models.Apartment.findById(u.id('apartment'), {
          include: [{
            model: models.Room,
            include: [models.Renting.scope({
              method: ['currentRenting', 'Rooms->Rentings'],
              required: false,
            })],
          }],
        });

        const currentRentingsIds =
          [].concat.apply([], apartment.Rooms.map(({ Rentings }) =>
            Rentings.map(({ id }) => id))
          );

        expect(currentRentingsIds.length).toEqual(2);
        expect(currentRentingsIds).toContain(u.id('current-renting2'));
        expect(currentRentingsIds).toContain(u.id('current-renting1'));
      });
    });
  });


  describe('#findOrCreateCheckinEvent()', () => {
    test('It should\'nt create a checkin event as it already exists', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
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
        Event: [{
          type: 'checkin',
          EventableId: u.id('renting'),
          eventable: 'Renting',
          startDate: D.parse('2017-05-16 Z'),
          endDate: D.parse('2017-05-16 Z'),
        }],
      }))({ method: 'create', hooks: false });

      const renting = await Renting.scope('room+apartment').findOne({
        where: { id: u.id('renting') },
        include: [{ model: models.Client }],
      });
      const [, isCreated] = await renting.findOrCreateCheckinEvent({
        startDate: '2017-05-16 Z',
        client: renting.Client,
        room: renting.Room,
        apartment: renting.Room.Apartment,
        hooks: false,
      });

      expect(isCreated).toEqual(false);
    });

    test('It should create a checkin event', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
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
      }))({ method: 'create', hooks: false });

      const renting = await Renting.scope('room+apartment').findOne({
        where: { id: u.id('renting') },
        include: [{ model: models.Client }],
      });

      const [, isCreated] = await renting.findOrCreateCheckinEvent({
        startDate: '2017-05-16 Z',
        client: renting.Client,
        room: renting.Room,
        apartment: renting.Room.Apartment,
        hooks: false,
      });

      expect(isCreated).toEqual(true);
    });
  });

  describe('.getPeriod', () => {
    test('it should return the Renting\'s status', () => {
      const date = D.parse('2017-07-07 Z');

      expect(Renting.getPeriod({
        get: () => D.parse('2016-03-03 Z'),
        bookingDate: D.parse('2016-01-01 Z'),
      }, date)).toEqual('past');
      expect(Renting.getPeriod({
        get: () => D.parse('2018-03-03 Z'),
        bookingDate: D.parse('2017-01-01 Z'),
      }, date)).toEqual('current');
      expect(Renting.getPeriod({
        get: () => D.parse('2018-03-03 Z'),
        bookingDate: D.parse('2018-01-01 Z'),
      }, date)).toEqual('future');
    });
  });

  describe('.calculatePriceAndFees', () => {
    test('it should calculate the price and service fees for the renting', () => {
      const room = {
        basePrice: 9500, // rounding-safe price
        Apartment: { roomCount: 3 },
      };
      const bookingDate = D.parse('2017-08-04 Z'); // 100% date
      const hasTwoOccupants = true;

      return Renting
        .calculatePriceAndFees({ room, bookingDate, hasTwoOccupants })
        .then(({ price, serviceFees }) => {
          expect(price).toEqual(18500);
          expect(serviceFees).toEqual(3000);
          return null;
        });
    });
  });

  describe('.updatePackLevel', () => {
    it('should update the label, price and productId of a pack item', () => {
      return fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
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
          packLevel: 'basic',
        }],
        Order: [{
          id: u.id('order'),
          ClientId: u.id('client'),
          label: 'Pack order',
          status: 'draft',
        }],
        OrderItem: [{
          id: u.id('packitem'),
          label: 'Basic pack item',
          unitPrice: 12300,
          RentingId: u.id('renting'),
          ProductId: 'basic-pack',
          status: 'draft',
        }],
      }))({ method: 'create', hooks: false })
      .tap(({ instances: { renting, packitem } }) => {
        expect(packitem.unitPrice).toEqual(12300);

        return Renting.updatePackLevel({
          renting,
          packLevel: 'comfort',
          addressCity: 'lyon',
        });
      })
      .then(({ instances: { packitem } }) => packitem.reload())
      .then((packitem) => {
        expect(packitem.label).toMatch(/co[mn]fort/);
        expect(packitem.unitPrice).not.toEqual(12300);
        expect(packitem.ProductId).toEqual('comfort-pack');

        return null;
      });
    });
  });

  describe('.updateDraftRentings', () => {
    const now = D.parse('2016-07-23');

    it('should\'t allow booking a room while it\'s rented', () =>
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
          basePrice: 65400,
        }],
        Renting: [{
          id: u.id('renting1'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
          bookingDate: D.parse('2016-07-13'),
          price: 56,
          serviceFees: 3000,
        }, {
          id: u.id('renting2'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
          bookingDate: D.parse('2016-07-27'),
          price: 89,
          serviceFees: 3000,
        }],
        Order: [{
          id: u.id('order'),
          ClientId: u.id('client'),
          status: 'draft',
        }],
        OrderItem: [{
          id: u.id('rentItem'),
          label: 'yo',
          OrderId: u.id('order'),
          RentingId: u.id('renting1'),
          ProductId: 'rent',
          status: 'draft',
          unitPrice: 12,
        }, {
          id: u.id('feesItem'),
          label: 'yo',
          OrderId: u.id('order'),
          RentingId: u.id('renting1'),
          ProductId: 'service-fees',
          status: 'draft',
          unitPrice: 34,
        }],
      }))({ method: 'create', hooks: false })
      .then(() => Renting.updateDraftRentings(now))
      .then((updatedTuples) => {
        const [[renting, rentItem, feesItem]] = updatedTuples;

        expect(updatedTuples.length).toEqual(1); // Only one renting should be updated
        expect(renting.bookingDate).toEqual(now);
        expect(renting.price).not.toEqual(56);
        expect(renting.serviceFees).toEqual(3000);
        expect(rentItem.unitPrice).not.toEqual(12);
        expect(feesItem.unitPrice).not.toEqual(34);

        return true;
      })
    );
  });
});
