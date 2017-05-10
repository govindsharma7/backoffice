const SCOPE = {
    paranoid: true,
    scopes: {
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
    },
};

module.exports = {
  SCOPE,
};
