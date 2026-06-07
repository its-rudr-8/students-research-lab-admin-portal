import { Navigate } from 'react-router-dom';

// Password reset now lives inside Login.tsx as a multi-step form.
export default function ResetPassword() {
  return <Navigate to="/login" replace />;
}
