#!/usr/bin/env node
const Promise    = require('bluebird');
const models     = require('../src/models');
const SendinBlue = require('../src/vendor/sendinblue');
const {
  SENDINBLUE_LIST_IDS,
}                = require('../src/config');

const { Client, Renting } = models;
const now = new Date();

return Client.scope('latestApartment')
  .findAll()
  .filter(({ Rentings }) => Rentings.length > 0)
  .map((client) => Promise.all([
    Renting.scope('checkoutDate')
      .findOne({
        where: {
          id: client.Rentings[0].id,
          '$checkoutDate$': {
            $and: {
              $lte: now,
              $not: null,
            },
          },
        },
      }),
    client,
  ]))
  .filter(([renting]) => renting !== null)
  .map(([, client]) =>
    SendinBlue.getContact(client.email)
      .then((_client) => {
        if ( !_client.listIds.some((list) => list === 25)) {
          return SendinBlue.updateContact(
            _client.email,
            {
              listIds: [SENDINBLUE_LIST_IDS.archived],
              unlinkListIds: _client.listIds,
            });
        }
        return true;
      })
  );
