module.exports.TRASH_SEGMENTS = [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
}];

module.exports.TRASH_SCOPES = {
  trashed: {
    where: {
      deletedAt: { $not: null },
      status: { $ne: 'draft'},
    },
    paranoid: false,
  },
  draft: {
    where: {
      deletedAt: { $not: null },
      status: 'draft',
    },
    paranoid: false,
  },
};
