const mongoose = require('mongoose');
const moment = require('moment');

const OfferModel = mongoose.model('Offer');

const { leadFilter } = require('../../../middlewares/ownership');

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

  // Resolved once and spread into all three $match stages. An aggregation does
  // not go through ownerFilter, so a child account's narrowed scope has to be
  // written in by hand here - and the counts must agree with the list they sit
  // above, or the dashboard would report leads the pipeline refuses to show.
  // leadFilter still returns plain ownerFilter for the workspace owner and for
  // any super admin.
  const scope = leadFilter(req);

  const pipeline = [
    {
      $facet: {
        totalClients: [
          {
            $match: {
              removed: false,
              enabled: true,
              ...scope,
            },
          },
          {
            $count: 'count',
          },
        ],
        newClients: [
          {
            $match: {
              removed: false,
              created: { $gte: startDate.toDate(), $lte: endDate.toDate() },
              enabled: true,
              ...scope,
            },
          },
          {
            $count: 'count',
          },
        ],
        activeClients: [
          {
            $lookup: {
              from: OfferModel.collection.name,
              localField: '_id', // Match _id from ClientModel
              foreignField: 'lead', // Match client field in OfferModel
              as: 'offer',
            },
          },
          {
            $match: {
              removed: false,
              ...scope,
              'offer.removed': false,
              // Left on the tenant id rather than folded into `scope`: these two
              // keys address the joined Offer, and `scope` describes leads. The
              // intention is "this lead has a live offer in this workspace", not
              // "this lead has an offer the caller personally created".
              'offer.createdBy': req.admin.tenantId,
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
