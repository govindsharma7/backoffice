const {
  REST_API_URL,
}                   = require('../config');

module.exports = function getInvoiceLink({ order, lang }) {
  const { receiptNumber, id } = order;
  const invoiceRoute = '/forest/actions/pdf-invoice';
  const filename = `invoice-${receiptNumber}.pdf`;
  const queryParams = `orderId=${id}&lang=${lang}`;

  return `${REST_API_URL}${invoiceRoute}/${filename}?${queryParams}`;
};
