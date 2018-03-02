const { DataTypes }               = require('sequelize');
const _                           = require('lodash');
const Utils                       = require('../../utils');
const {
  TRASH_SCOPES,
  CITIES,
}                                 = require('../../const');
const Geocode                     = require('../../vendor/geocode');
const sequelize                   = require('../sequelize');
const collection                  = require('./collection');
const routes                      = require('./routes');
const hooks                       = require('./hooks');

const { required } = Utils;
const citiesScopes = CITIES.reduce(
  (acc, curr) => Object.assign(acc, { [curr]: { where: { addressCity: curr } } }),
  {}
);

const Apartment = sequelize.define('Apartment', {
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
  addressStreet:            DataTypes.STRING,
  addressZip:               DataTypes.STRING,
  addressCity:              DataTypes.ENUM(CITIES),
  addressCountry:           DataTypes.ENUM('france'),
  code:                     DataTypes.STRING,
  floor:                    DataTypes.INTEGER,
  elevator:                 DataTypes.BOOLEAN,
  roomCount:                DataTypes.INTEGER,
  latLng:                   DataTypes.STRING,
  floorArea:                DataTypes.FLOAT,
  status: {
    type:                   DataTypes.ENUM('draft', 'active'),
    defaultValue: 'active',
    required: true,
  },
  descriptionEn:            DataTypes.TEXT,
  descriptionFr:            DataTypes.TEXT,
  descriptionEs:            DataTypes.TEXT,
}, {
  paranoid: true,
  scopes: Object.assign(citiesScopes, TRASH_SCOPES),
});

Apartment.associate = (models) => {
  Apartment.belongsTo(models.District, {
    constraints: false,
  });
  Apartment.hasMany(models.Room);
  Apartment.hasMany(models.Picture, {
    foreignKey: 'PicturableId',
    constraints: false,
    scope: { picturable: 'Apartment' },
  });
  Apartment.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'Apartment' },
  });
  Apartment.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Apartment' },
  });
};

Apartment.prototype.calculateLatLng = function() {
  return Apartment.calculateLatLng({ apartment: this });
};
Apartment.calculateLatLng = async function({ apartment }) {
  const { addressStreet, addressZip, addressCountry } = apartment;
  const { lat, lng } =
    await Geocode(`${addressStreet}, ${addressZip}, ${addressCountry}`);

  return `${lat},${lng}`;
};

Apartment.generateDescriptionFr = function(args) {
  const { apartment = required(), district = required() } = args;

  return [
    _.shuffle([
      'Concernant le',
      'À propos du',
      'En ce qui concerne le',
      'S\'agissant du',
    ])[0],
    'logement, il',
    _.shuffle([
      'se situe',
      'se trouve',
      'est situé',
      'est localisé',
      'est placé',
    ])[0],
    `dans le quartier ${district.label}, en plein`,
    `${_.shuffle(['centre', 'coeur'])[0]} de ${apartment.addressCity}.`,
    `De nombreux ${_.shuffle(['commerces', 'restaurants', 'transports']).join(', ')}`,
    _.shuffle([
      'se situent',
      'se trouvent',
      'sont situés',
      'sont localisés',
    ])[0],
    _.shuffle([
      'à proximité.',
      'aux alentours.',
      'dans le quartier.',
      'aux environs.',
    ])[0],
    `La colocation est à l'étage n°${apartment.floor}`,
    `${apartment.elevator ? 'avec ascenceur' : ''}. Ell est`,
    `${_.shuffle(['prête-à-vivre', 'entièrement meublée'])[0]} et`,
    `${_.shuffle(['offre', 'possède', 'propose', 'dispose d\''])[0]} une cuisine`,
    _.shuffle([
      'équipée',
      'tout équipée',
      '100% équipée',
      'complètement équippée',
      'équipée de A à Z',
    ])[0],
    `avec ${_.shuffle(['frigo', 'réfrégirateur'])[0]}`,
    // TODO: add aditional kitchen equipments
    `${_.shuffle([
      'micro-ondes',
      'bouilloire',
      'poêles',
      'casseroles',
      'vaiselle',
      'ustensiles',
    ]).join(', ')}…`,
    _.shuffle(['Ainsi que', 'Mais aussi', 'De même que'])[0],
    // TODO: mention washing machine if present,
    `${_.shuffle([
      'fer à repasser',
      'planche à repasser',
      'tancarville',
    ]).join(', ')}.\n`,
    _.shuffle([
      'Tout le materiel',
      'Tout le nécessaire',
      'Tout ce qu\'il faut',
      'Le materiel',
    ])[0],
    'pour le ménage est',
    _.shuffle(['présent', 'sur place', 'déjà présent', 'fourni'])[0],
    _.shuffle(['dans', 'au sein', 'à l\'intérieur de'])[0],
    `${_.shuffle(['la', 'cette'])[0]} colocation :`,
    `${_.shuffle([
      'aspirateur',
      'balai',
      'balai-brosse',
      'seau et serpillère',
    ]).join(', ')}…`,
    `Chaque colocation meublée Chez Nestor ${_.shuffle(['comprend', 'inclut'])[0]}`,
    'toutes les charges :',
    `${_.shuffle([
      'wifi illimité',
      'eau',
      'électricité',
      'assurance habitation',
      'charges de copropriété',
      'taxe sur les ordures',
      // TODO: mention gas if present
    ]).join(', ')}.`,

  ].join(' ');
};

Apartment.generateDescriptionEn = function(args) {
  const { apartment = required(), district = required() } = args;

  return [
    'The flatshare',
    _.shuffle([
      'is located',
      'can be found',
      'is situated',
      'is strategically located',
    ])[0],
    `in the "${district.label}" neighborhood, in the`,
    `${_.shuffle(['heart', 'centre'])[0]} of ${apartment.addressCity}.`,
    _.shuffle([
      'Several',
      'Many',
      'A lot of',
      'Loads of',
      'Plenty of',
    ])[0],
    _.shuffle(['shops', 'restaurants', 'public transports']).join(', '),
    _.shuffle([
      'are available',
      'are accessible',
      'can be found',
      'are at your disposal',
      'are located',
    ])[0],
    _.shuffle([
      'nearby.',
      'near-at-hand.',
      'close-by.',
      'close at hand.',
    ])[0],
    `The colocation is on floor ${apartment.floor}`,
    `${apartment.elevator ? ', with elevator' : ''}. It is`,
    _.shuffle(['entirely equipped', 'entirely furnished', 'ready-to-live-in'])[0],
    `and ${_.shuffle(['is composed of', 'includes', 'consists of'])[0]} a`,
    _.shuffle(['fully equipped', 'large', 'fitted', 'complete'])[0],
    `kitchen with ${_.shuffle(['fridge', 'refregirator'])[0]}`,
    // TODO: add aditional kitchen equipments
    `${_.shuffle([
      'microwave',
      'kettle',
      'pans',
      'crockery',
      'kitchen utensils',
    ]).filter(Boolean).join(', ')}…`,
    `${_.shuffle(['But also', 'And also', 'As well as'])[0]}`,
    // TODO: mention washing machine if present,
    `${_.shuffle(['iron', 'ironing board', 'clothes rack']).join(', ')}.\n`,
    `${_.shuffle(['You will also', 'Additionally, you will'])[0]} find`,
    _.shuffle(['all you need', 'an equipment', 'the equipment'])[0],
    'for cleaning',
    _.shuffle([
      'directly in the apartment:',
      'in the partment:',
      'in the colocation:',
      'already provided in the apartment:',
    ])[0],
    `${_.shuffle([
      'bagless hoover',
      'broom',
      'mop and bucket',
      'dustpan and brush',
    ]).join(', ')}…`,
    'Every Chez Nestor furnished flatshare includes all',
    `${_.shuffle(['bills', 'expenses'])[0]}:`,
    `${_.shuffle([
      'unlimited wi-fi',
      'water',
      'electricity',
      'housing insurance',
      'condominum fees',
      'household waste tax',
      // TODO: mention gas if present
    ]).join(', ')}.`,

  ].join(' ');
};

Apartment.collection = collection;
Apartment.routes = routes;
Apartment.hooks = hooks;

module.exports = Apartment;
