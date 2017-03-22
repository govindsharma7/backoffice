// This script was used to initialize the database of users, using data from InvoiceNinja
module.exports = (Ininja) => {
  Ininja.client.listClients({
    'per_page': 300,
  })
  .then((response) => {
    let clients = response.obj.data
      .filter((client) => {
        return !client.is_deleted && client.contacts.length;
      })
      .map((client) => {
        return {
          id: `${client.contacts[0].first_name}-${client.contacts[0].last_name}`
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\W/g, '-'),
          firstName: client.contacts[0].first_name,
          lastName: client.contacts[0].last_name,
          email: client.contacts[0].email,
          invoiceninjaClientId: client.id,
        };
      });

    console.log(JSON.stringify(clients));
  })
  .catch((error) => {
    console.error(error);
    throw error;
  });
};
