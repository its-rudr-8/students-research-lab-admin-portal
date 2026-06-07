import { Navigate } from 'react-router-dom';

// OTP verification now lives inside Login.tsx as a multi-step form.
export default function VerifyOtp() {
  return <Navigate to="/login" replace />;
}
