module.exports = function({ District }) {

  // Queries that are triggered by the district search-field shouldn't
  // have a limit
  District.hook('beforeFind', (options) => {
    const { include, offset, limit } = options;

    if ( include.length === 0 && offset === 0 && limit === 10 ) {
      options.limit = 40;
    }

    return options;
  });
};
