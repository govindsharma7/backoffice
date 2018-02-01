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

1. Create a sequelize migration that adds the city to the enum in Apartment tabl
2. Create a new folder in Sendinblue and new lists (fr/en/all)
3. Modifiy CITIES and SENDINBLUE_LIST_IDS in src/const.js
4. Test the migration on dev, on staging, and then run it on prod

## License

MPLv2.0
