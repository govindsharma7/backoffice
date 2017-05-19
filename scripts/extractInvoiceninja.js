#!/usr/bin/env node

const Ininja = require('../src/vendor/invoiceninja');

// This script was used to initialize the database of users, using data from InvoiceNinja
return Ininja.client
  .listClients({
    'per_page': 400,
  })
  .then((response) => {
    var ids = {};
    var emails = {};

    let clients = response.obj.data
      .filter((client) => {
        return !client.is_deleted && client.contacts.length;
      })
      .map((client) => {
        const firstName = client.contacts[0].first_name.trim();
        const lastName = client.contacts[0].last_name.trim();
        const id =
          `${firstName}-${lastName}`
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\W/g, '-');
        const email = client.contacts[0].email.trim() || `UNKNOWN@${Math.random()}`;

        if ( id in ids ) {
          console.error(`Non unique id spotted: ${id}`);
        }
        ids[id] = true;
        if ( email in emails ) {
          console.error(`Non unique email spotted: ${email}`);
        }
        emails[email] = true;

        return {
          id,
          firstName,
          lastName,
          email,
          ninjaId: client.id,
        };
      });

    return console.log(JSON.stringify({
      model: 'Client',
      length: clients.length,
      records: clients,
    }, null, '  '));
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
