// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from 'react-oidc-context';
import type { User } from 'oidc-client-ts';

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XF0vQvYuH",
  client_id: "641sh8j3j5iv62aot4ecnlpc3q", // <-- IMPORTANT: Replace with your actual client ID
  redirect_uri: "https://cloudbillanalyzer.epiuse-aws.com", // <-- Your production URL
  post_logout_redirect_uri: "https://cloudbillanalyzer.epiuse-aws.com",
  response_type: "code",
  scope: "phone openid email",
  automaticSilentRenew: true, // Keep the session alive automatically
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