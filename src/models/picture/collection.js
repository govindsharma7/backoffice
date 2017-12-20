module.exports = function() {
  return {
    fields: [{
      // for some reason, Forest excludes belongsTo foreign keys from schemas
      // a quick and safe hack to bring it back is to create an alias
      field: '_PicturableId',
      type: 'String',
      get(object) { return object.PicturableId; },
    }],
  };
};
