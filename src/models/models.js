const virtualModels = {};
// Make sure models aren't used before they're initialized
// Unfortunately this doesn't work and I have no idea why :-/
// const models = {};
//
// [
//   'Apartment',
//   'Client',
//   'Credit',
//   'District',
//   'Event',
//   'Metadata',
//   'Order',
//   'OrderItem',
//   'Payment',
//   'Picture',
//   'Product',
//   'Renting',
//   'Room',
//   'Setting',
//   'Term',
//   // Keep models sorted alphabetically!
// ].forEach((name) =>
//   Object.defineProperty(virtualModels, name, {
//     get: () => {
//       if ( models[name] ) {
//         return models[name];
//       }
//
//       throw new Error('models haven\'t been initialized yet');
//     },
//     set: (model) => {
//       models[name] = model;
//     },
//   })
// );

module.exports = virtualModels;
