module.exports = function() {
  return {
    name: 'Invoice',
    idField: 'id',
    fields: [{
      field: 'id',
      type: 'String',
    }, {
      field: 'href',
      type: 'String',
    }],
  };
};
