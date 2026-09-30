const mongoose = require('mongoose');
const moment = require('moment');

const Model = mongoose.model('Invoice');

const { loadSettings } = require('../../../middlewares/settings');
const { assignmentFilter } = require('../../../middlewares/ownership');
const { withDateWindow } = require('../../../utils/dateRange');

const summary = async (req, res) => {
  let defaultType = 'month';

  const { type } = req.query;

  const settings = await loadSettings(req.admin.tenantId);

  if (type) {
    if (['week', 'month', 'year'].includes(type)) {
      defaultType = type;
    } else {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Invalid type',
      });
    }
  }

  const currentDate = moment();
  let startDate = currentDate.clone().startOf(defaultType);
  let endDate = currentDate.clone().endOf(defaultType);

  const statuses = ['draft', 'pending', 'overdue', 'paid', 'unpaid', 'partially'];

  // An aggregation does not pass through scopedFilter, so a child account's
  // own-record scope has to be written into each $match by hand. Without it this
  // card would report the whole workspace's invoices to an account whose invoice
  // list shows only its own - the totals would contradict the table underneath
  // them. Empty for the owner and for a super admin, so their figures are
  // unchanged. See middlewares/ownership.js.
  const scope = {
    createdBy: req.admin.tenantId,
    ...assignmentFilter(Model, req),
  };

  const response = await Model.aggregate([
    {
      // The tenant scope, the account's own-record narrowing inside it, and the
      // dashboard's date window if one was asked for - as separate $and entries
      // so the window can only narrow what the scope already allowed. See
      // utils/dateRange.js. The date clauses that used to sit here commented out
      // were driven by `type`, a preset that never reached the query; the window
      // is now sent by the dashboard and applied for real.
      $match: withDateWindow(Model, req, scope),
    },
    {
      $facet: {
        totalInvoice: [
          {
            $group: {
              _id: null,
              total: {
                $sum: '$total',
              },
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              total: '$total',
              count: '$count',
            },
          },
        ],
        statusCounts: [
          {
            $group: {
              _id: '$status',
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: '$count',
            },
          },
        ],
        paymentStatusCounts: [
          {
            $group: {
              _id: '$paymentStatus',
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: '$count',
            },
          },
        ],
        overdueCounts: [
          {
            $match: {
              expiredDate: {
                $lt: new Date(),
              },
            },
          },
          {
            $group: {
              _id: '$status',
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: '$count',
            },
          },
        ],
      },
    },
  ]);

  let result = [];

  const totalInvoices = response[0].totalInvoice ? response[0].totalInvoice[0] : 0;
  const statusResult = response[0].statusCounts || [];
  const paymentStatusResult = response[0].paymentStatusCounts || [];
  const overdueResult = response[0].overdueCounts || [];

  const statusResultMap = statusResult.map((item) => {
    return {
      ...item,
      percentage: Math.round((item.count / totalInvoices.count) * 100),
    };
  });

  const paymentStatusResultMap = paymentStatusResult.map((item) => {
    return {
      ...item,
      percentage: Math.round((item.count / totalInvoices.count) * 100),
    };
  });

  const overdueResultMap = overdueResult.map((item) => {
    return {
      ...item,
      status: 'overdue',
      percentage: Math.round((item.count / totalInvoices.count) * 100),
    };
  });

  statuses.forEach((status) => {
    const found = [...paymentStatusResultMap, ...statusResultMap, ...overdueResultMap].find(
      (item) => item.status === status
    );
    if (found) {
      result.push(found);
    }
  });

  const unpaid = await Model.aggregate([
    {
      // The same window as the totals above, so the amount still owed and the
      // total invoiced describe the same set of documents rather than two
      // different periods.
      $match: withDateWindow(Model, req, scope, {
        paymentStatus: {
          $in: ['unpaid', 'partially'],
        },
      }),
    },
    {
      $group: {
        _id: null,
        total_amount: {
          $sum: {
            $subtract: ['$total', '$credit'],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total_amount: '$total_amount',
      },
    },
  ]);

  const finalResult = {
    total: totalInvoices?.total,
    total_undue: unpaid.length > 0 ? unpaid[0].total_amount : 0,
    type,
    performance: result,
  };

  return res.status(200).json({
    success: true,
    result: finalResult,
    message: `Successfully found all invoices for the last ${defaultType}`,
  });
};

module.exports = summary;
