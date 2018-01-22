#!/usr/bin/env node
require('../src/models').Picture.destroy({ where: { createdAt: { $not: null } } });
