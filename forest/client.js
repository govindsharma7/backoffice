const Liana          = require('forest-express-sequelize');
const diffInYears    = require('date-fns/difference_in_years');
const {Metadata}     = require('../src/models');
const Utils          = require('../src/utils');
const {
  TRASH_SEGMENTS,
  INVOICENINJA_URL,
}                    = require('../src/const');

const cache = new WeakMap();

function getClientIdentyMemoized(object) {
  if ( cache.has(object) ) {
    return cache.get(object);
  }

  const promise = Metadata.findOne({
      where: {
        MetadatableId: object.id,
        name: 'clientIdentity',
      },
    })
    .then((instance) => {
      if (instance) {
        const data  = JSON.parse(instance.value);

        return {
          nationality: data.nationality,
          status: data.frenchStatus === 'Student' ||
              data.frenchStatus === 'Intern' ? 'Student' : 'Worker',
          birthDate : Object.keys(data.birthDate)
                        .map((key) => {
                          return data.birthDate[key];
                        }).reverse().join(', '),
        };
      }
      return null;
    })
    .tapCatch(console.error);

  cache.set(object, promise);
  return promise;
}


Liana.collection('Client', {
  fields: [{
    field: 'Full Name',
    type: 'String',
    get(object) {
      return `${object.firstName} ${object.lastName}`;
    },
  }, {
    field: 'ninja',
    type: 'String',
    get(object) {
      if (object.ninjaId !== null) {
        return `${INVOICENINJA_URL}/clients/${object.ninjaId}`;
      }

      return null;
    },
  }, {
    field: 'jotform link',
    type: 'String',
    get(object) {
      return `https://form.jotformpro.com/50392735671964?clientId=${object.id}`;
    },
  }, {
    field: 'Description En',
    type: 'String',
    get(object) {
      return getClientIdentyMemoized(object)
        .then((result) => {
          if ( result ) {
            return Utils.stripIndent(`\
              ${object.firstName}, ${diffInYears(Date.now(), result.birthDate)} \
              years old ${result.status} from ${result.nationality}`);
          }

          return null;
        });
    },
  }, {
    field: 'Description Fr',
    type: 'String',
    get(object) {
      return getClientIdentyMemoized(object)
        .then((result) => {
          if ( result ) {
            return Utils.stripIndent(`\
              ${object.firstName}, \
              ${result.status === 'Student' ? 'étudiant(e)' : 'jeune actif(ve)'} de \
              ${diffInYears(Date.now(), result.birthDate)} ans \
              venant de ${result.nationality}`);
          }

          return null;
        });
    },
  }, {
    field: 'Invoices',
    type: ['String'],
    reference: 'Invoice.id',
  }, {
    field: 'Rentings',
    type: ['String'],
    reference: 'Renting.id',
  }, {
    field: 'Orders',
    type: ['String'],
    reference: 'Order.id',
  }],
  actions:[{
    name: 'Credit Client',
    fields: [{
        field: 'cardHolder',
        type: 'String',
        description: 'required',
      }, {
        field: 'cardNumber',
        type: 'Number',
        description: 'required',
      }, {
        field: 'expirationMonth',
        type: 'Enum',
        enums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
        description: 'required',
      }, {
        field: 'expirationYear',
        type: 'Enum',
        enums: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
        description: 'required',
      }, {
        field: 'cvv',
        type: 'Number',
        description: 'required',
      }, {
        field: 'cardType',
        type: 'Enum',
        enums: ['MasterCard', 'Visa'],
        description: 'required',
      }, {
        field: 'amount',
        type: 'Number',
        description: 'required',
      }, {
        field: 'reason',
        type: 'String',
      }, {
        field: 'orderLabel',
        type: 'String',
      },
    ],
  }, {
    name: 'Generate Lease',
  }, {
    name: 'Create Rent Order',
    fields: [{
      field: 'for',
      type: 'Enum',
      enums: ['current month', 'next month'],
    }],
  }, {
    name: 'Restore Client',
  }, {
    name: 'Destroy Client',
  }],
  segments: TRASH_SEGMENTS,
});
