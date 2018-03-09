const Promise                 = require('bluebird');
const { SENDINBLUE_LIST_IDS } = require('../../const');
const Sendinblue              = require('../../vendor/sendinblue');
const { NODE_ENV }            = require('../../config');

module.exports = function({ Client }) {
  /*
   * Those hooks are used to update Invoiceninja records when clients are updated
   * in Forest.
   */
  Client.handleAfterCreate = function (client) {
    if ( NODE_ENV === 'test' || client.id === 'maintenance' ) {
      return client;
    }

    return Sendinblue.createContact(client.email, { client });
  };
  Client.hook('afterCreate', (client) =>
    Client.handleAfterCreate(client)
  );

  Client.hook('afterUpdate', (client) => {
    if ( NODE_ENV === 'test' ) {
      return client;
    }

    if ( client.changed('email') ) {
      Sendinblue.getContact(client._previousDataValues.email)
        .then((_client) => Promise.all([
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
        ]))
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

    return true;
  });
};
