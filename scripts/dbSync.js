#!/usr/bin/env node

require('../src/models');

return require('../src/models/sequelize').sync();
