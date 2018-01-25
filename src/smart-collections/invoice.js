const Promise     = require('bluebird');
const D           = require('date-fns');
const uniq        = require('lodash/uniq');
const Liana       = require('forest-express-sequelize');
const Schemas     = require('forest-express/generators/schemas');
const CSVExporter = require('forest-express/services/csv-exporter');

const _ = { uniq };

// This will be accessed by SmartFieldsValuesInjector when calling CSVExporter
// Without this, CSVExporter would crash.
Schemas.schemas = Liana.Schemas.schemas;

function collection(/*{ Order }*/) {
  return {
    name: 'Invoice',
    idField: 'id',
    fields: [{
      field: 'id',
      type: 'String',
    }, {
      field: 'label',
      type: 'String',
    }, {
      field: 'invoiceNumber',
      type: 'String',
      get: ({ receiptNumber}) => receiptNumber,
    }, {
      field: 'clientFullName',
      type: 'String',
      get: ({ Client: { firstName, lastName } }) =>
        `${firstName} ${lastName.toUpperCase()}`,
    }, {
      field: 'amountTaxExcluded',
      type: 'Number',
      get: ({ OrderItems }) =>
        OrderItems.reduce(
          (acc, { quantity, unitPrice }) => acc + quantity * unitPrice,
          0
        ),
    }, {
      field: 'VAT',
      type: 'Number',
      get: ({ OrderItems }) =>
        _.uniq(OrderItems.map(({ vatRate }) => vatRate)).join(' | '),
    }, {
      field: 'amountTaxIncluded',
      type: 'Number',
      get: getTotalAmount,
    }, {
      field: 'dueDate',
      type: 'String',
      get: ({ dueDate }) => D.format(dueDate, 'DD/MM/YYYY'),
    }, {
      field: 'totalPaid',
      type: 'Number',
      get: getTotalPaid,
    }, {
      field: 'balance',
      type: 'Number',
      get: (object) => getTotalPaid(object) - getTotalAmount(object),
    }, {
      field: 'paymentType',
      type: 'String',
      get: ({ Payments }) =>
        _.uniq(Payments.map(({ type }) => type)).join(' | '),
    }, {
      field: 'paymentDate',
      type: 'String',
      get: ({ Payments }) =>
        _.uniq(Payments.map(({ createdAt }) =>
          D.format(createdAt, 'DD/MM/YYYY'))
        ).join(' | '),
    }, {
      field: 'city',
      type: 'String',
      get: (object) => {
        const room = getRoom(object);

        return room && room.Apartment.addressCity;
      },
    }, {
      field: 'room',
      type: 'String',
      get: (object) => {
        const room = getRoom(object);

        return room && room.name;
      },
    }],
    segments: [{
      name: 'future invoices',
    }, {
      name: 'previous month invoices',
    }],
  };
}

function routes(app, models) {
  const { Order, Client, OrderItem, Renting, Room, Apartment, Payment } = models;
  const findParams = {
    order: [['dueDate', 'DESC']],
    include: [{
      model: Client,
      attributes: ['firstName', 'lastName'],
    }, {
      model: Payment,
      attributes: ['type', 'amount', 'createdAt'],
    }, {
      model: OrderItem,
      include: [{
        model: Renting,
        required: false,
        attributes: ['id'],
        include: [{
          model: Room,
          attributes: ['name'],
          include: [{
            model: Apartment,
            attributes: ['addressCity'],
          }],
        }],
      }],
    }],
  };

  app.get('/forest/Invoice', Liana.ensureAuthenticated, async (req, res) => {
    const { page, segment } = req.query;
    const where = getWhere(segment);
    const params = {
      where,
      limit: Number(page.size),
      offset: ( Number(page.number) - 1 ) * Number(page.size),
    };
    const [count, orders] = await Promise.all([
      Order.count({ where }),
      Order.findAll(Object.assign(params, findParams)),
    ]);

    const fake = { getModelName: () => 'Invoice' };
    const serializer =
      new Liana.ResourceSerializer(fake, null, orders, null, {}, { count });
    const invoices = await serializer.perform();

    return res.send(invoices);
  });

  app.get('/forest/Invoice.csv', Liana.ensureAuthenticated, async (req, res) => {
    const params = { where: getWhere(req.query.segment) };
    const orders = await Order.findAll(Object.assign( params, findParams ));
    const fake = { perform: (fn) => fn(orders) };

    return new CSVExporter(req.query, res, 'Invoice', fake).perform();
  });
}

function getRoom({ OrderItems }) {
  const item = OrderItems.find(({ Renting }) => Boolean(Renting));

  return item && item.Renting.Room;
}

function getTotalAmount({ OrderItems }) {
  return OrderItems.reduce(
    (acc, { quantity, unitPrice, vatRate }) =>
      acc + quantity * unitPrice * ( 1 + Number(vatRate) ),
    0
  );
}

function getTotalPaid({ Payments }) {
  return Payments.reduce(
    (acc, { amount }) => acc + amount,
    0
  );
}

function getWhere(segment, date = D.subMonths(new Date(), 1)) {
  return {
    receiptNumber: { $not: null },
    dueDate: segment === 'previous month invoices' ?
      { $gte: D.startOfMonth(date), $lt: D.endOfMonth(date) } :
      { $gte: D.endOfMonth(date) },
  };
}

module.exports = {
  collection,
  routes,
};
