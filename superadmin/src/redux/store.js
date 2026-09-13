import { configureStore } from '@reduxjs/toolkit';

import rootReducer from './rootReducer';
import storePersist from './storePersist';

const AUTH_INITIAL_STATE = {
  current: {},
  isLoggedIn: false,
  isLoading: false,
  isSuccess: false,
};

// Persisted under the same 'auth' key the shared request layer reads to build
// the Authorization header. Because that key is origin-scoped, this app must
// never be served from the same origin as the main ERP (see vite.config.js).
const auth_state = storePersist.get('auth') ? storePersist.get('auth') : AUTH_INITIAL_STATE;

const store = configureStore({
  reducer: rootReducer,
  preloadedState: { auth: auth_state },
  devTools: import.meta.env.PROD === false,
});

export default store;
