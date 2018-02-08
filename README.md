# Chez Nestor Backoffice

Our brand new back-office built with Forest, hosted on Lambda and deployed with up.
You can use this project to take inspiration, but we're keeping a few secrets for us.

## Installation

- Install Travis-cli: `gem install travis` (see [installation instructions](https://github.com/travis-ci/travis.rb#installation))
- Install deps: `npm install`

## Usage

- Start dev server: `npm start`
- List available tasks: `npm run help`

## Test

`npm test`

## How To

### Adding a new city checklist

1. Create a sequelize migration that adds the city to the enum in Apartment table
1. Create a new folder in Sendinblue and new lists (fr/en/all)
1. Create a new checkin/checkout calendar in Google Calendar
1. Copy the Checkin/Checkout lyon zap and review/edit it from start to end
1. Add the city to the list of <city>-deposit products in seed/index.js
1. Modifiy CITIES, SENDINBLUE_LIST_IDS, GOOGLE_CALENDAR_IDS in src/const.js
1. Modify PACK_PRICES and DEPOSIT_PRICES in cheznestor-common
1. Test the migration on dev, on staging, and then run it on prod

## License

MPLv2.0
