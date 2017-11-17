const Promise       = require('bluebird');
const Sendinblue    = require('../../vendor/sendinblue');
const Utils         = require('../../utils');
const {
  NODE_ENV,
}                    = require('../../config');
const {
  SENDINBLUE_LIST_IDS,
}                    = require('../../const');

module.exports = function({ Client }) {
  /*
   * Those hooks are used to update Invoiceninja records when clients are updated
   * in Forest.
   */
  Client.hook('afterCreate', (client) => {
    if ( NODE_ENV === 'test' || client.id === 'maintenance' ) {
      return client;
    }

    const promises = [
      Sendinblue.createContact(client.email, { client }),
    ];

    if ( !client.ninjaId ) {
      promises.push(client.ninjaCreate());
    }

    return Promise.all(promises);
  });

  Client.hook('afterUpdate', (client) => {
    if ( NODE_ENV === 'test' ) {
      return client;
    }

    if ( client.changed('email') ) {
      Sendinblue.getContact(client._previousDataValues.email)
        .then((_client) => {
          return Promise.all([
            Sendinblue.updateContact(
              _client.email,
              {
                listIds: [SENDINBLUE_LIST_IDS.archived],
                unlinkListIds: _client.listIds,
              }),
            Sendinblue.createContact(client.email, {
              client,
              listIds: _client.listIds,
            }),
          ]);
        })
        .catch((err) => {
          if ( err.response.body.code === 'document_not_found' ) {
            return Sendinblue.createContact(client.email, { client });
          }

          throw err;
        });
    }
    else {
      Sendinblue.updateContact(client.email, { client });
    }
    if (
      client.ninjaId && (
        client.changed('firstName') ||
        client.changed('lastName') ||
        client.changed('email')
      )
    ) {
      return client.ninjaUpdate();
    }

    return true;
  });
};
