const reduce            = require('lodash/reduce');
const {
  GraphQLSchema,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
}                       = require('graphql');
const Sequelize         = require('sequelize');
const {
  attributeFields,
  resolver,
  defaultArgs,
  defaultListArgs,
  relay,
}                       = require('graphql-sequelize');
const ResourcesGetter   = require('forest-express-sequelize/services/resources-getter');

const _ = {reduce};

module.exports = function(models) {
  const opts = { sequelize: Sequelize };
  const {
    nodeInterface,
    nodeField,
    nodeTypeMapper,
  } = relay.sequelizeNodeInterface({ models });
  const types = _.reduce(models, (types, model, name) => {

    types[name] = new GraphQLObjectType({
        name,
        description: model.description || `A ${name}`,
        fields: () => {
          // This allows pre-defining some fields in the model
          const fields = model.specialAttributeFields || {};

          // model.connections = Object.keys(model.associations).map((associationName) =>
          //   relay.sequelizeConnection({
          //     name: associationName,
          //     nodeType: types[model.associations[associationName].target.name],
          //     target: model.associations[associationName],
          //   })
          // );
          //
          // (model.connections || []).forEach((connection) => {
          //   fields[connection.name] = {
          //     type: connection.connectionType,
          //     args: connection.connectionArgs,
          //     resolve: connection.resolve,
          //   };
          // });

          return Object.assign(
            fields,
            attributeFields(model, {
              exclude: Object.keys(model.specialAttributeFields || {}),
              globalId: 'globalId' in model ? model.globalId : true,
            })
          );
        },
        interfaces: [nodeInterface],
      });

    return types;
  }, {});

  nodeTypeMapper.mapTypes(types);

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: _.reduce(models, (fields, model, name) => {
        if ( model.excludeFromSchema === true ) {
          return fields;
        }

        const resolve = resolver(model);

        fields[name] = {
          type: types[name],
          args: defaultArgs(model),
          resolve,
        };
        fields[`${name}s`] = {
          type: new GraphQLList(types[name]),
          args: Object.assign({
            search: { type: GraphQLString },
          },
          defaultListArgs(model)),
          resolve: (source, args, context, info) => {
            // if a search argument is present, use forest-express-sequelize
            // search feature instead of sequelize-graphql querying
            if ( args.search ) {
              args.fields = {
                [model.name]:
                  info.fieldNodes[0].selectionSet.selections.map((selection) =>
                    selection.name.value
                  ).join(','),
              };

              return new ResourcesGetter(model, opts, args)
                .perform()
                .then(([, records]) => records);
            }

            return resolve(source, args, context, info)
              .then((result) => result);
          },
        };

        return fields;
      }, {}),
      field: nodeField,
    }),
  });
};
