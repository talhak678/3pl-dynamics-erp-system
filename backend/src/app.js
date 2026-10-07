const express = require('express');

const cors = require('cors');
const compression = require('compression');

const cookieParser = require('cookie-parser');

require('./models');

const coreAuthRouter = require('./routes/coreRoutes/coreAuth');
const coreApiRouter = require('./routes/coreRoutes/coreApi');
const coreDownloadRouter = require('./routes/coreRoutes/coreDownloadRouter');
const corePublicRouter = require('./routes/coreRoutes/corePublicRouter');
const superAdminRouter = require('./routes/coreRoutes/superAdminApi');
const teamRouter = require('./routes/coreRoutes/teamApi');
// TEMPORARY. Unauthenticated by design so a one-off backfill can be triggered
// by opening a URL. Remove this require and the mount below together, once the
// backfill has been run. See the warning in the router itself.
const workspaceBackfillRouter = require('./routes/coreRoutes/workspaceBackfillApi');
const adminAuth = require('./controllers/coreControllers/adminAuth');
const requireSuperAdmin = require('./middlewares/requireSuperAdmin');
const requireTenantOwner = require('./middlewares/requireTenantOwner');

const errorHandlers = require('./handlers/errorHandlers');
const erpApiRouter = require('./routes/appRoutes/appApi');

const fileUpload = require('express-fileupload');
// create our Express app
const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(compression());

// // default options
// app.use(fileUpload());

// Here our API Routes

app.use('/api', coreAuthRouter);
// Mounted ahead of the generic /api routers: `app.use('/api', ...)` matches any
// /api/* path, so placing this after them would run isValidAuthToken twice per
// request. Order within this line matters too — isValidAuthToken populates
// req.admin, which requireSuperAdmin reads.
app.use('/api/superadmin', adminAuth.isValidAuthToken, requireSuperAdmin, superAdminRouter);
// The Customer Admin's own employee management. Mounted here for the same
// reason as the line above - ahead of the generic /api routers, so
// isValidAuthToken runs once per request rather than twice.
app.use('/api/team', adminAuth.isValidAuthToken, requireTenantOwner, teamRouter);
// TEMPORARY PUBLIC MOUNT - no auth, by explicit request. Declared before the
// generic `/api` routers below because `app.use('/api', ...)` matches any
// /api/* path and would otherwise claim this one first. Every other /api mount
// is guarded; this one is not, on purpose, and it should not survive the
// deployment after the backfill has been run. See the router.
app.use('/api/workspace', workspaceBackfillRouter);
app.use('/api', adminAuth.isValidAuthToken, coreApiRouter);
app.use('/api', adminAuth.isValidAuthToken, erpApiRouter);
app.use('/download', coreDownloadRouter);
app.use('/public', corePublicRouter);

// If that above routes didnt work, we 404 them and forward to error handler
app.use(errorHandlers.notFound);

// production error handler
app.use(errorHandlers.productionErrors);

// done! we export it so we can start the site in start.js
module.exports = app;
