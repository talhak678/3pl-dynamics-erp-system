import { combineReducers } from 'redux';

import { reducer as authReducer } from './auth';

// Auth is the only slice this portal needs. The ERP's crud, erp, advancedCrud
// and settings reducers are deliberately absent: a Super Admin owns no tenant
// data and never renders a CRUD or invoice screen.
const rootReducer = combineReducers({
  auth: authReducer,
});

export default rootReducer;
