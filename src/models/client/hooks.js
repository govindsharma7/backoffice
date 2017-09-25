const Promise    = require('bluebird');
const SendinBlue = require('../../vendor/sendinblue');
const Utils      = require('../../utils');
const {
  SENDINBLUE_LIST_IDS,
}                = require('../../const');

module.exports = function(models, Client) {
  /*
   * Those hooks are used to update Invoiceninja records when clients are updated
   * in Forest.
   */
  Client.hook('afterCreate', (client) => {
    const promises = [
      SendinBlue.createContact(client.email, { client }),
    ];

    if ( !client.ninjaId ) {
      promises.push(client.ninjaCreate());
    }

    return Utils.wrapHookPromise(Promise.all(promises));
  });

  Client.hook('afterUpdate', (client) => {
    if ( client.changed('email') ) {
      SendinBlue.getContact(client._previousDataValues.email)
        .then((_client) => {
          return Promise.all([
            SendinBlue.updateContact(
              _client.email,
              {
                listIds: [SENDINBLUE_LIST_IDS.archived],
                unlinkListIds: _client.listIds,
              }),
            SendinBlue.createContact(client.email, {
              client,
              listIds: _client.listIds,
            }),
          ]);
        })
        .catch((err) => {
          if ( err.response.body.code === 'document_not_found' ) {
            return SendinBlue.createContact(client.email, { client });
          }

          throw err;
        });
    }
    else {
      SendinBlue.updateContact(client.email, {
        attributes: SendinBlue.serializedClient(client),
      });
    }
    if (
      client.ninjaId && (
        client.changed('firstName') ||
        client.changed('lastName') ||
        client.changed('email')
      )
    ) {
      return Utils.wrapHookPromise(client.ninjaUpdate());
    }

    return true;
  });
};
