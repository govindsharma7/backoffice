const Promise = require('bluebird');

module.exports = function(houseMates, value) {
  const data = JSON.parse(value);
  const {day, month, year} = data.checkinDate;
  const common = {
    FIRSTNAME: data.fullName.first,
    CITY: houseMates[0].Rentings[0].Room.Apartment.addressCity,
    ARRIVAL: `${day}/${month}/${year}`,
    EMAIL: data.email,
  };
  const fr = {
    COUNTRY: data.nationalityFr,
    WORK:  data.isStudent ? 'étudier' : 'travailler',
  };
  const en = {
    COUNTRY: data.nationalityEn,
    WORK:  data.isStudent ? 'study' : 'work',
  };
  const emailFr = [];
  const emailEn = [];

  houseMates
    .filter((houseMate) => houseMate.preferredLanguage === 'fr')
    .map((houseMate) => emailFr.push(houseMate.email));

  houseMates
    .filter((houseMate) => houseMate.preferredLanguage === 'en')
    .map((houseMate) => emailEn.push(houseMate.email));

  return Promise.all([
    Object.assign({}, common, fr),
    Object.assign({}, common, en),
    emailFr,
    emailEn,
  ]);
};
