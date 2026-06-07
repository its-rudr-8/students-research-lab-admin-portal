import { Navigate } from 'react-router-dom';

// The forgot password flow now lives inside Login.tsx as a multi-step form.
export default function ForgotPassword() {
  return <Navigate to="/login" replace />;
}
