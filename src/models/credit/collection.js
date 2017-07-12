const {TRASH_SEGMENTS} = require('../../const');

module.exports = function() {
  return {
    actions: [{
      name: 'Restore Credit',
    }, {
      name: 'Destroy Credit',
    }],
    segments: TRASH_SEGMENTS,
  };
};
