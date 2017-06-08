const reduce         = require('lodash/reduce');
const {
  GraphQLSchema,
  GraphQLList,
  GraphQLObjectType,
}                    = require('graphql');
const {
  attributeFields,
  resolver,
  defaultArgs,
  defaultListArgs,
  // relay,
}                    = require('graphql-sequelize');
const isModel        = require('./isModel');

const _ = {reduce};
const Utils = {isModel};

module.exports = function(models) {
  const types = _.reduce(models, (types, model, name) => {
    // make sure this is a sequelize model
    if ( !Utils.isModel(model) ) {
      return types;
    }

    types[name] = new GraphQLObjectType({
        name,
        description: model.description || `A ${name}`,
        fields: () => {
          const fields = model.specialAttributeFields || {};

          (model.connections || []).forEach((connection) => {
            fields[connection.name] = {
              type: connection.connectionType,
              args: connection.connectionArgs,
              resolve: connection.resolve,
            };
          });

          return Object.assign(
            fields,
            attributeFields(model, {
              exclude: Object.keys(model.specialAttributeFields || {}),
            })
          );
        },
      });

    return types;
  }, {});

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: _.reduce(models, (fields, model, name) => {
        if ( !Utils.isModel(model) || model.excludeFromSchema === true ) {
          return fields;
        }

        fields[name] = {
          type: types[name],
          args: defaultArgs(model),
          resolve: resolver(model),
        };
        fields[`${name}s`] = {
          type: new GraphQLList(types[name]),
          args: defaultListArgs(model),
          resolve: resolver(model),
        };

        return fields;
      }, {}),
    }),
  });
};
