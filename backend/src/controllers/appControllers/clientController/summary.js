const mongoose = require('mongoose');
const moment = require('moment');

const { assignmentFilter } = require('../../../middlewares/ownership');
const { dateMatchFor } = require('../../../utils/dateRange');

const InvoiceModel = mongoose.model('Invoice');

const summary = async (Model, req, res) => {
  let defaultType = 'month';
  const { type } = req.query;

  if (type && ['week', 'month', 'year'].includes(type)) {
    defaultType = type;
  } else if (type) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid type',
    });
  }

  const currentDate = moment();
  let startDate = currentDate.clone().startOf(defaultType);
  let endDate = currentDate.clone().endOf(defaultType);

  /*
   * The tenant clause every stage below shares, plus the own-record narrowing a
   * child account's client reads carry everywhere else.
   *
   * Spelled here rather than through scopedFilter because this method builds an
   * aggregation pipeline rather than a query filter: there is no ownerFilter call
   * to swap, the tenant id is written into each $match directly. The narrowing is
   * the same one, though - this card is a Client read, and leaving it tenant-wide
   * would put a workspace-wide customer count on the dashboard of an account that
   * cannot open the customer list it describes.
   *
   * Only the client half narrows. The `invoice.*` keys describe invoices, and the
   * "active client" ratio is the caller's own active clients over their own
   * clients - both sides of the fraction move together, so the percentage stays
   * meaningful.
   */
  const clientScope = {
    createdBy: req.admin.tenantId,
    ...assignmentFilter(Model, req),
  };

  const pipeline = [
    {
      $facet: {
        totalClients: [
          {
            $match: {
              removed: false,
              enabled: true,
              ...clientScope,
            },
          },
          {
            $count: 'count',
          },
        ],
        newClients: [
          {
            // The one facet on this card that is a period, and so the only one
            // the dashboard's window applies to. "New" means new inside the
            // window, measured against the all-time client total the other two
            // facets count - a share of the clients gained in the last 30 days
            // would say nothing about the customer base. That is why
            // totalClients and activeClients below are deliberately left
            // unfiltered: they are the denominator both percentages are taken
            // over, and windowing them would turn "active" into a ratio over
            // clients that happen to be new.
            //
            // An explicit window beats the `type` preset rather than
            // intersecting with it. They measure the same thing over different
            // spans, so $and-ing them would silently answer a narrower question
            // than the one asked - 'last 30 days' intersected with the current
            // calendar month is just the calendar month, which is not what was
            // chosen. The preset remains the answer for a caller that sends no
            // window, which is every caller from before this feature.
            $match: {
              $and: [
                { removed: false },
                { enabled: true },
                clientScope,
                dateMatchFor(Model, req.query) || {
                  created: { $gte: startDate.toDate(), $lte: endDate.toDate() },
                },
              ],
            },
          },
          {
            $count: 'count',
          },
        ],
        activeClients: [
          {
            $lookup: {
              from: InvoiceModel.collection.name,
              localField: '_id', // Match _id from ClientModel
              foreignField: 'client', // Match client field in InvoiceModel
              as: 'invoice',
            },
          },
          {
            $match: {
              removed: false,
              ...clientScope,
              'invoice.removed': false,
              'invoice.createdBy': req.admin.tenantId,
            },
          },
          {
            $group: {
              _id: '$_id',
            },
          },
          {
            $count: 'count',
          },
        ],
      },
    },
  ];

  const aggregationResult = await Model.aggregate(pipeline);

  const result = aggregationResult[0];
  const totalClients = result.totalClients[0] ? result.totalClients[0].count : 0;
  const totalNewClients = result.newClients[0] ? result.newClients[0].count : 0;
  const activeClients = result.activeClients[0] ? result.activeClients[0].count : 0;

  const totalActiveClientsPercentage = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;
  const totalNewClientsPercentage = totalClients > 0 ? (totalNewClients / totalClients) * 100 : 0;

  return res.status(200).json({
    success: true,
    result: {
      new: Math.round(totalNewClientsPercentage),
      active: Math.round(totalActiveClientsPercentage),
    },
    message: 'Successfully get summary of new clients',
  });
};

module.exports = summary;
