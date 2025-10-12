// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from 'react-oidc-context';

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XF0vQvYuH",
  client_id: "641sh8j3j5iv62aot4ecnlpc3q", // <-- IMPORTANT: Replace with your actual client ID
  redirect_uri: "https://cloudbillanalyzer.epiuse-aws.com", // <-- Your production URL
  response_type: "code",
  scope: "phone openid email",
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>
);