const Promise                 = require('bluebird');
const { SENDINBLUE_LIST_IDS } = require('../../const');
const Sendinblue              = require('../../vendor/sendinblue');

module.exports = function({ Client }) {
  /*
   * Those hooks are used to update Sendinblue records when clients are updated
   * in Forest.
   */
  Client.handleAfterCreate = function (client) {
    if ( client.id === 'maintenance' ) {
      return client;
    }

    return Sendinblue.createContact(client.email, { client });
  };
  Client.hook('afterCreate', (client) =>
    Client.handleAfterCreate(client)
  );

  Client.hook('afterUpdate', async (client) => {
    if ( !client.changed('email') ) {
      return Sendinblue.updateContact(client.email, { client });
    }
    // else
    const contact =
      await Sendinblue.getContact(client._previousDataValues.email);

    // It's not possible to update the email of a contact. Instead we need
    // to "archive" the current contact and create a new one
    return Promise.all([
      Sendinblue.updateContact(contact.email, {
        listIds: [SENDINBLUE_LIST_IDS.archived],
        unlinkListIds: contact.listIds,
      }).catch((err) => {
        if ( err.response.body.code === 'document_not_found' ) {
          return Sendinblue.createContact(client.email, { client });
        }

        throw err;
      }),
      Sendinblue.createContact(client.email, {
        client,
        listIds: contact.listIds,
      }),
    ]);
  });
};
