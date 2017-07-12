const {TRASH_SEGMENTS} = require('../../const');

module.exports = function() {
  return {
    actions: [{
      name: 'Restore Event',
    }, {
      name: 'Destroy Event',
    }],
    segments: TRASH_SEGMENTS,
  };
};
