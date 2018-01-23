function collection() {
  return {
    name: 'rentalAttachment',
    idField: 'id',
    fields: [{
      field: 'id',
      type: 'String',
    }, {
      field: 'href',
      type: 'String',
    }],
  };
}

module.exports = {
  collection,
};
