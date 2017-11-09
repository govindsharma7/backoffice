// /!\ Values in this file will be <findOrCreate>d on each deploy
// All records in this file need an `id`
const flattenDeep  = require('lodash/flattenDeep');

const _ = { flattenDeep };
const nearbySchools = {
  'lyon-hotel-de-ville': [
    'L\'EAC',
    'IFPEC, Institut Français de Psychologie Énergétique Clinique',
    'Ecole Interculturelle de Français pour Etrangers eife2f',
    'Ecole Lyonnaise Plantes Médicinales (E.L.P.M)',
    'HORIZON SANTE Lyon - BTS Diététique & ESF',
    'Ecole de théâtre de Lyon',
    'Centre Linguistique Franco Russe CLRF',
    'Institut Rhonalpin Analyse Transaction',
    'Inflexion - école de langue',
  ],
  'lyon-bellecour': [
    'UCLy - Université Catholique de Lyon (campus Carnot)',
    'ESME Sudria Lyon',
    'Bellecour Ecoles d\'Art',
    'Peyrefitte',
    'Institut Préparatoire Carrières Sportives',
    'Ecole Internationale Tunon',
  ],
  'lyon-ainay': [
    'UCLy - Université Catholique de Lyon (campus Carnot)',
    'ESME Sudria Lyon',
    'Bellecour Ecoles d\'Art', 'Peyrefitte',
    'Institut Préparatoire Carrières Sportives',
    'Ecole Internationale Tunon',
    'ESDES',
  ],
  'lyon-confluence': [
    'UCLy - Université Catholique de Lyon (campus Carnot)',
    'ESDES',
    'ESTRI School for international careers of UCLy',
  ],
  'lyon-debourg-gerland': [
    'CNRS / Université Lyon 1',
    'ENS de Lyon - Site Monod',
    'ISARA-Lyon',
    'Anses Lyon',
    'Insert',
  ],
  'lyon-universites': [
    'Université Lyon 3 Jean Moulin',
    'Université Lumière Lyon 2',
    'Sciences Po Lyon', 'Ingésup Lyon',
    'BBA INSEEC - Ecole de Commerce Européenne',
  ],
};

module.exports = {
  Setting: [{
    id: 'invoice-counter',
    type: 'int',
    value: 3773,
  }],
  Product: [{
    id: 'service-fees',
    name: 'Service Fees',
  }, {
    id: 'rent',
    name: 'Rent',
  }, {
    id: 'basic-pack',
    name: 'Basic Pack',
  }, {
    id: 'comfort-pack',
    name: 'Comfort Pack',
  }, {
    id: 'privilege-pack',
    name: 'Privilege Pack',
  }, {
    id: 'special-checkin',
    name: 'Special Checkin',
  }, {
    id: 'special-checkout',
    name: 'Special Checkout',
  }, {
    id: 'late-notice',
    name: 'Late Notice',
  }, {
    id: 'room-switch',
    name: 'Room Switch',
  }, {
    id: 'late-fees',
    name: 'Late fees',
  }, {
    id: 'lyon-deposit',
    name: 'Lyon deposit',
  }, {
    id: 'montpellier-deposit',
    name: 'Montpellier deposit',
  }, {
    id: 'paris-deposit',
    name: 'Paris deposit',
  }, {
    id: 'uncashed-deposit',
    name: 'Uncashed Deposit',
  }, {
    id: 'service-overcharging-fees',
    name: 'Service Overcharging Fees',
  }, {
    id: 'discount',
    name: 'Discount',
  }, {
    id: 'other',
    name: 'Other',
  }],
  Client: [{
    id: 'maintenance',
    firstName: 'Chez',
    lastName: 'Nestor',
    email: 'support@chez-nestor.com',
    status: 'draft',
    phoneNumber: '0000000',
  }],
  District: [{
      id: 'lyon-ainay',
      label: 'Ainay - Presqu\'île',
  }, {
      id: 'lyon-confluence',
      label: 'Confluence - Presqu\'île',
  }, {
      id: 'lyon-bellecour',
      label: 'Bellecour - Presqu\'île',
  }, {
      id: 'lyon-hotel-de-ville',
      label: 'Hôtel de Ville - Presqu\'île',
  }, {
      id: 'lyon-croix-rousse',
      label: 'Croix Rousse',
  }, {
      id: 'lyon-tete-dor',
      label: 'Tête d\'Or',
  }, {
      id: 'lyon-brotteaux',
      label: 'Brotteaux',
  }, {
      id: 'lyon-foch',
      label: 'Foch',
  }, {
      id: 'lyon-part-dieu',
      label: 'Part Dieu',
  }, {
      id: 'lyon-manufacture',
      label: 'Manufacture',
  }, {
      id: 'lyon-prefecture',
      label: 'Prefecture',
  }, {
      id: 'lyon-quais-de-rhone',
      label: 'Quais de Rhône',
  }, {
      id: 'lyon-guillotiere',
      label: 'Guillotière',
  }, {
      id: 'lyon-universites',
      label: 'Universités',
  }, {
      id: 'lyon-jean-mace',
      label: 'Jean Macé',
  }, {
      id: 'lyon-garibaldi',
      label: 'Garibaldi',
  }, {
      id: 'lyon-jet-deau',
      label: 'Jet d\'Eau',
  }, {
      id: 'lyon-debourg-gerland',
      label: 'Debourg - Gerland',
  }, {
      id: 'lyon-vieux-lyon',
      label: 'Vieux Lyon',
  }, {
      id: 'lyon-vaise',
      label: 'Vaise',
  }, {
      id: 'lyon-monchat',
      label: 'Monchat',
  }, {
      id: 'montpellier-centre-historique-comedie',
      label: 'Centre Historique - Comédie',
  }, {
      id: 'montpellier-boutonnet',
      label: 'Boutonnet',
  }, {
      id: 'montpellier-beaux-arts',
      label: 'Beaux-Arts',
}, {
      id: 'montpellier-aubes-pompignane',
      label: 'Aubes - Pompignane',
  }, {
      id: 'montpellier-antigone',
      label: 'Antigone',
  }, {
      id: 'montpellier-gares',
      label: 'Gares',
  }, {
      id: 'montpellier-gambetta',
      label: 'Gambetta',
  }, {
      id: 'montpellier-figuerolles',
      label: 'Figuerolles',
  }, {
      id: 'montpellier-les-arceaux',
      label: 'Les Arceaux',
  }, {
      id: 'montpellier-hopitaux-facultes',
      label: 'Hôpitaux - Facultés',
  }, {
      id: 'montpellier-aiguelongue',
      label: 'Aiguelongue',
  }, {
      id: 'montpellier-millenaire',
      label: 'Millénaire',
  }, {
      id: 'montpellier-port-marianne',
      label: 'Port-Marianne',
  }, {
      id: 'montpellier-aiguerelles',
      label: 'Aiguerelles',
  }, {
      id: 'montpellier-saint-martin',
      label: 'Saint-Martin',
  }, {
      id: 'montpellier-pres-darenes',
      label: 'Près d\'Arènes',
  }, {
      id: 'montpellier-estanove',
      label: 'Estanove',
  }, {
      id: 'montpellier-pas-du-loup',
      label: 'Pas du Loup',
  }, {
      id: 'montpellier-chamberte',
      label: 'Chamberte',
  }, {
      id: 'opera-grands-boulevards',
      label: 'Opéra - Grands Boulevards',
    }, {
      id: 'paris-marais',
      label: 'Marais',
    }, {
      id: 'paris-1er-arrondissement',
      label: '1er Arrondissement',
    }, {
      id: 'paris-4e-arrondissement',
      label: '4e Arrondissement',
    }, {
      id: 'paris-5e-arrondissement',
      label: '5e Arrondissement',
    }, {
      id: 'paris-6e-arrondissement',
      label: '6e Arrondissement',
    }, {
      id: 'paris-orsay-invalides',
      label: 'Orsay - Invalides',
    }, {
      id: 'paris-etoile-champs-elysees',
      label: 'Etoile - Champs Elysées',
    }, {
      id: 'paris-saint-lazare',
      label: 'Saint-Lazare',
    }, {
      id: 'paris-monceau-ternes',
      label: 'Monceau - Ternes',
    }, {
      id: 'paris-madeleine',
      label: 'Madeleine',
    }, {
      id: 'paris-montmartre',
      label: 'Montmartre',
    }, {
      id: 'paris-gare-du-nord',
      label: 'Gare du Nord',
    }, {
      id: 'paris-canal-saint-martin',
      label: 'Canal Saint-Martin',
    }, {
      id: 'paris-bastille',
      label: 'Bastille',
    }, {
      id: 'paris-republique',
      label: 'République',
    }, {
      id: 'paris-oberkampf',
      label: 'Oberkampf',
    }, {
      id: 'paris-bercy',
      label: 'Bercy',
    }, {
      id: 'paris-nation',
      label: 'Nation',
    }, {
      id: 'paris-daumesnil',
      label: 'Daumesnil',
    }, {
      id: 'paris-bibliotheque-nationale',
      label: 'Bibliothèque Nationale',
    }, {
      id: 'paris-place-ditalie',
      label: 'Place d\'Italie',
    }, {
      id: 'paris-massena',
      label: 'Masséna',
    }, {
      id: 'paris-monsouris',
      label: 'Monsouris',
    }, {
      id: 'paris-alesia',
      label: 'Alesia',
    }, {
      id: 'paris-montparnasse-denfert-rochereau',
      label: 'Montparnasse - Denfert Rochereau',
    }, {
      id: 'paris-vaugirard',
      label: 'Vaugirard',
    }, {
      id: 'paris-grenelle-javel',
      label: 'Grenelle - Javel',
    }, {
      id: 'paris-champs-de-mars',
      label: 'Champs de Mars',
    }, {
      id: 'paris-auteuil',
      label: 'Auteuil',
    }, {
      id: 'paris-trocadero',
      label: 'Trocadéro',
    }, {
      id: 'paris-16e-arrondissement',
      label: '16e Arrondissement',
    }, {
      id: 'paris-batignolles',
      label: 'Batignolles',
    }, {
      id: 'paris-clichy-fourche',
      label: 'Clichy - Fourche',
    }, {
      id: 'paris-goutte-dor',
      label: 'Goutte d\'Or',
    }, {
      id: 'paris-clignancourt',
      label: 'Clignancourt',
    }, {
      id: 'paris-vilette',
      label: 'Vilette',
    }, {
      id: 'paris-buttes-chaumont',
      label: 'Buttes Chaumont',
    }, {
      id: 'paris-belleville',
      label: 'Belleville',
    }, {
      id: 'paris-pere-lachaise',
      label: 'Père Lachaise',
    }],
  Term: _.flattenDeep(Object.keys(nearbySchools).map((district) => {
    return nearbySchools[district].map((school) => {
      return {
        name: school,
        taxonomy: 'nearbySchool',
        termable: 'District',
        TermableId: district,
      };
    });
  })),
};
