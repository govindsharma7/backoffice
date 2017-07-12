const {TRASH_SEGMENTS} = require('../../const');

module.exports = function() {
  return {
    actions: [{
      name: 'Restore Product',
    }, {
      name: 'Destroy Product',
    }],
    segments: TRASH_SEGMENTS,
  };
};
