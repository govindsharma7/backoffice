/* eslint-disable */
var P = require('bluebird');
var request = require('superagent');

function AllowedUsersFinder(renderingId, opts) {
  this.perform = function () {
    return new P(function (resolve) {
      var forestUrl = process.env.FOREST_URL ||
        'https://forestadmin-server.herokuapp.com';

      request
        .get(forestUrl + '/forest/renderings/' + renderingId +
          '/allowed-users')
        .set('forest-secret-key', opts.envSecret)
        .end(function (error, result) {console.log('YOOOOOOOOOOOOOOOOOOOOO!');
          allowedUsers = [];
          if (result.status === 200 && result.body && result.body.data) {
            result.body.data.forEach(function (userData) {
              var user = userData.attributes;
              user.id = userData.id;
              allowedUsers.push(user);
            });
          } else {
            if (result.status === 0) {
              console.log('Cannot retrieve any users for the project ' +
                'you\'re trying to unlock. Forest API seems to be down right ' +
                'now.');
            } else if (result.status === 404) {
              console.log('Cannot retrieve the project you\'re trying to ' +
                'unlock. Can you check that you properly copied the Forest ' +
                'envSecret in the forest_liana initializer?');
            } else {
              console.log('Cannot retrieve any users for the project ' +
                'you\'re trying to unlock. An error occured in Forest API.',
                error);
              console.log(error);
              console.log(result);
            }
          }
          resolve(allowedUsers);
        });
    });
  };
}

module.exports = AllowedUsersFinder;
