const { DataTypes }     = require('sequelize');
const Promise           = require('bluebird');
const D                 = require('date-fns');
const _                 = require('lodash');
const uuid              = require('uuid/v4');
const Op                = require('../../operators');
const { TRASH_SCOPES }  = require('../../const');
const Utils             = require('../../utils');
const sequelize         = require('../sequelize');
const models            = require('../models'); //!\ Destructuring forbidden /!\
const collection        = require('./collection');
const routes            = require('./routes');
const hooks             = require('./hooks');

const { methodify, required } = Utils;

const Room = sequelize.define('Room', {
  id: {
    primaryKey: true,
    type:                   DataTypes.UUID,
    defaultValue:           DataTypes.UUIDV4,
  },
  reference: {
    type:                   DataTypes.STRING,
    unique: true,
  },
  name:                     DataTypes.STRING,
  floorArea:                DataTypes.FLOAT,
  basePrice:                DataTypes.FLOAT,
  beds:                     DataTypes.ENUM(
    'double', 'simple', 'sofa', 'double+sofa', 'simple+sofa', 'simple+simple'
  ),
  status: {
    type:                   DataTypes.ENUM('draft', 'active'),
    defaultValue: 'active',
    // required: true,
    // allowNull: false,
  },
  descriptionEn:            DataTypes.TEXT,
  descriptionFr:            DataTypes.TEXT,
  descriptionEs:            DataTypes.TEXT,
  // WATCH OUT: only meaningful when availableAt scope is used
  availableAt: {
    type:                   DataTypes.VIRTUAL(DataTypes.DATE),
    get() {
      const { availableAt } = this.dataValues;

      return availableAt == null || typeof availableAt == 'object' ?
        availableAt : Utils.parseDBDate(availableAt);
    },
  },
  // WATCH OUT: only meaningful when apartment and availableAt scopes are used
  currentPrice: {
    type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
    async get() {
      if ( this.availableAt == null ) {
        return Promise.resolve(null);
      }

      const [periodCoef, serviceFees] = await Promise.all([
        Utils.getPeriodCoef(D.max(Utils.now(), this.availableAt)),
        Utils.getServiceFees({ apartment: this.Apartment }),
      ]);

      return Utils.getPeriodPrice( this.basePrice, periodCoef, serviceFees );
    },
  },
  // WATCH OUT: only meaningful when apartment scope is used
  serviceFees: {
    type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
    get() {
      return Utils.getServiceFees({ apartment: this.Apartment });
    },
  },
  roomNumber: {
    type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Room.associate = (models) => {
  Room.belongsTo(models.Apartment, {
    foreignKey: { notNull: true },
  });
  Room.hasMany(models.Renting);
  Room.hasMany(models.Picture, {
    foreignKey: 'PicturableId',
    constraints: false,
    scope: { picturable: 'Room' },
  });
  Room.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'Room' },
  });
  Room.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Room' },
  });

  Room.addScope('availableAt', (_args) => {
    const args = Object.assign({
       includeClient: false,
       availability: 'any',
    }, _args);
    let where = {};

    if ( args.availability === 'sellable' || args.availability === 'available' ) {
      where = { [Op.or]: [
        { '$Rentings.id$': null },
        { '$Rentings->Events.id$': args.availability === 'sellable' ?
          { [Op.not]: null } :
          { [Op.lte]: Utils.now() },
        },
      ] };
    }

    return {
      subQuery: false, // we're good, there's only one latestRenting
      attributes: { include: [
        [sequelize.literal([
          '(CASE WHEN `Rentings`.`id` IS NULL',
            'THEN \'1970-01-01T00:00:00Z\'',
            'ELSE `Rentings->Events`.`startDate`',
          'END)',
        ].join(' ')), 'availableAt'],
      ] },
      where,
      include: [{
        model: models.Renting.scope({ method: ['latestRenting', 'Rentings'] }),
        required: false,
        include: args.includeClient ? [{
          model: models.Client.scope('clientMeta'),
        }] : [],
      }],
    };
  });

  // This might be useful some day but isn't used now
  ['currentClient', 'latestClient'].forEach((scopeName) =>
    Room.addScope(scopeName, () => ({
      include: [{
        model: models.Renting.scope({
          method: [scopeName.replace('Client', 'Renting'), 'Rentings'],
        }),
        required: false,
        include: [models.Client],
      }],
    }))
  );
};

// Make a room unavailable for a period of time (from and to included)
Room.prototype.createMaintenancePeriod = function({ from, to }) {
  const id = uuid();

  // We can't use Sequelize's include option because it wouldn't allow us
  // to disable hooks on event creation.
  return Promise.all([
    models.Renting.create({
      id,
      bookingDate: from,
      status: 'active',
      ClientId: 'maintenance',
      RoomId: this.id,
    }, { hooks: false }),
    to && models.Event.create({
      startDate: to,
      endDate: to,
      EventableId: id,
      eventable: 'Renting',
      summary: 'End of maintenance',
      description: `${this.name}`,
      type: 'checkout',
    }, { hooks: false }),
  ]);
};

Room.getPriceAndFees = async function(args) {
  const { room = required(), apartment /* not required! */, date } = args;
  const [periodCoef, serviceFees] = await Promise.all([
    Utils.getPeriodCoef(date),
    Utils.getServiceFees({ apartment }),
  ]);
  const price =
    await Utils.getPeriodPrice( room.basePrice, periodCoef, serviceFees );

  return {
    periodCoef,
    serviceFees,
    price,
  };
};
methodify(Room, 'getPriceAndFees');

Room.generateDescriptionFr = function({ room = required(), apartment = required() }) {
  return [
    'Cette',
    _.shuffle(['superbe', 'magnifique', 'ravissante', 'splendide', 'sublime'])[0],
    `chambre ${_.shuffle(['', 'privative', 'privée'])[0]}`,
    'en colocation, meublée, équipée et',
    _.shuffle(['tout inclus', 'prête-à-vivre', 'clef en main'])[0],
    `à ${_.capitalize(apartment.addressCity)}`,
    _.shuffle(['offre', 'allie', 'vous offre', 'associe', 'accorde', 'unit'])[0],
    'confort et design. Elle',
    _.shuffle(['dispose', 'possède', 'offre', 'propose', 'présente', 'dispose'])[0],
    'de nombreux équipements comme un lit',
    /double/.test(room.beds) ? 'double' : 'simple',
    'confortable et hypoallergénique avec couette et oreillers.',
    // TODO: add full list of equipments here,
    _.shuffle([
      'Il ne manque plus que',
      'Il n\'y a plus à apporter que',
      'Ne reste plus qu\'à apporter',
      'Ne vous reste plus à apporter que',
      'Ne vous manque plus à apporter que',
    ])[0],
    _.shuffle(['votre valise', 'votre bagage', 'vos affaires', 'vos vêtements'])[0],
    'pour',
    _.shuffle(['emménager !', 'y vivre !', 'vous installer !', 'être chez vous !'])[0],
    'La chambre',
    _.shuffle([
      'ferme à clef',
      'possède un verrou',
      'possède un cadenas',
      'peut se fermer à clef',
    ])[0],
    'pour',
    _.shuffle([
      'plus d\'intimité.',
      'garder vos affaires en sécurité.',
      'protéger vos affaires.',
      'plus de sécurité.',
    ])[0],

  ].join(' ');
};

Room.generateDescriptionEn = function({ room = required(), apartment = required() }) {
  return [
    'This',
    _.shuffle(['superb', 'elegant', 'splendid', 'stunning', 'marvelous', 'lovely'])[0],
    _.shuffle(['room', 'bedroom', 'private bedroom', 'private room'])[0],
    'in a fully equipped, furnished and',
    _.shuffle(['all-inclusive', 'ready-to-live-in', 'turn-key'])[0],
    `flatshare in ${_.capitalize(apartment.addressCity)}`,
    _.shuffle([
      'is a perfect combination of',
      'offers you',
      'will offer you',
      'perfectly marries',
      'perfectly combines',
      'is a mix of',
      'puts together',
    ])[0],
    'comfort and design. It',
    _.shuffle(['has', 'comes with', 'has got', 'benefits from', 'consists of'])[0],
    _.shuffle([
      'household furnishings,',
      'lots of household goods,',
      'many household items,',
      'plenty of household equipment,',
    ])[0],
    // TODO: add full list of equipments here,
    `including a ${/double/.test(room.beds) ? 'double' : 'simple'}`,
    'bed with pillows and duvet',
    _.shuffle([
      'what is missing is',
      'Now all you need is to bring',
      'All you need to do is to bring',
      'Just bring',
    ])[0],
    `your ${_.shuffle(['luggage', 'belongings', 'things', 'stuff'])[0]} to`,
    _.shuffle([
      'feel good in your new home!',
      'feel at home!',
      'make this place your own!',
      'feel cosy in your new place!',
      'settle in well!',
    ])[0],
    'The room',
    _.shuffle([
      'can be locked',
      'has a lock',
      'has a door latch',
      'has a security lock',
    ])[0],
    _.shuffle([
      'for more privacy.',
      'to keep your stuff safe.',
      'for security matters.',
      'to protect your privacy.',
    ])[0],

  ].join(' ');
};

Room.collection = collection;
Room.routes = routes;
Room.hooks = hooks;

module.exports = Room;
