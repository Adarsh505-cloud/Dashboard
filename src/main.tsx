// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from 'react-oidc-context';
import type { User } from 'oidc-client-ts';

const cognitoAuthConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY || "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XF0vQvYuH",
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID || "641sh8j3j5iv62aot4ecnlpc3q",
  redirect_uri: import.meta.env.VITE_REDIRECT_URI || "https://cloudbillanalyzer.epiuse-aws.com",
  post_logout_redirect_uri: import.meta.env.VITE_REDIRECT_URI || "https://cloudbillanalyzer.epiuse-aws.com",
  response_type: "code",
  scope: "phone openid email",
  automaticSilentRenew: true,
};

// This callback removes the auth params from the URL after login.
const onSigninCallback = (_user: User | void): void => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  </StrictMode>
);