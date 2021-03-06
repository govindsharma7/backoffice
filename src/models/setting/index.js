const Promise         = require('bluebird');
const { DataTypes }   = require('sequelize');
const sequelize       = require('../sequelize');
const collection      = require('./collection');

const Setting = sequelize.define('Setting', {
  id: {
    primaryKey: true,
    type:                     DataTypes.STRING,
    required:                 true,
  },
  type: {
    type:                     DataTypes.ENUM('str', 'int'),
    required: true,
    defaultValue: 'str',
    allowNull: false,
  },
  value: {
    type:                     DataTypes.VIRTUAL,
    get() {
      switch (this.type) {
      case 'int':
        return this.intVal;
      case 'str':
      default:
        return this.strVal;
      }
    },
    set(val) {
      switch (this.type) {
      case 'int':
        return this.intVal = val;
      case 'str':
      default:
        return this.strVal = val;
      }
    },
  },
  strVal:                     DataTypes.STRING,
  intVal:                     DataTypes.INTEGER,
});

Setting.prototype._increment = Setting.prototype.increment;

Setting.prototype.increment = function(options) {
  if ( !this.type === 'int' ) {
    return Promise.reject(new Error(
      `Increment only works on 'int' settings, found: ${this.type}`
    ));
  }

  return this._increment('intVal', options);
};

Setting.excludeFromSchema = true;
Setting.collection = collection;

module.exports = Setting;
