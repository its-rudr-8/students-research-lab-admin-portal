

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { isAuthenticated, saveSession } from '../lib/auth';
import { adminAPI, setAuthToken } from '../lib/adminApi';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loginEmail = email.trim();
      const loginPassword = password.trim();

      // Call the admin login API
      const response = await adminAPI.login(loginEmail, loginPassword);

      if (!response.success || !response.token) {
        throw new Error(response.message || "Login failed");
      }

      // Save JWT token
      setAuthToken(response.token);

      // Save session data
      const user = response.user;
      // Backend may return enrollment_no (snake_case) or enrollmentNo (camelCase)
      const enrollmentNo: string | undefined =
        user.enrollmentNo || user.enrollment_no || undefined;
      saveSession({
        email: user.email,
        name: user.name,
        enrollmentNo,
        role: user.is_admin ? "admin" : (user.role || "member"),
      }, response.token);

      toast({
        title: "Login successful",
        description: user.role === "admin" ? "Admin access enabled." : "Member access granted.",
      });

      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid credentials. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-pastel-gradient-login overflow-x-hidden">
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-[1000px] flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-14 lg:mt-6">

          {/* Left Side: Branding & Logo (Desktop & Tablet) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex-1 flex flex-col items-center space-y-8 mt-16"
          >
            {/* Logo Display - Clean and Simple with Shining Border */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-300 via-cyan-200 to-teal-300 rounded-full blur-xl opacity-80 animate-pulse" />
              <motion.img
                src="/SRL Logo.svg"
                alt="Students Research Lab Logo"
                className="w-80 h-80 drop-shadow-2xl transition-transform duration-500 rounded-full border-4 border-teal-400/70 shadow-2xl shadow-teal-400/70"
                whileHover={{ scale: 1.05 }}
              />
            </div>

            {/* Title Below Logo */}
            <div className="w-full text-center">
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tighter">
                <span className="animate-gradient-text">Students Research Lab</span>
              </h1>
            </div>
          </motion.div>

          {/* Right Side: Login Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full max-w-[390px] space-y-4 lg:mt-2"
          >
            <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 lg:p-10 shadow-2xl flex flex-col items-center">
              <p className="text-[11px] sm:text-[12px] leading-relaxed text-center italic text-teal-950/80 mb-6 sm:mb-8 font-semibold max-w-[300px] tracking-tight">
                "Fostering a disciplined research culture, consistency in academic practice, and excellence through collaborative scholarly engagement"
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-teal-950 mb-1 tracking-tight">Login to SRL</h2>
              <p className="text-xs sm:text-sm text-teal-800/80 mb-6 sm:mb-8 font-bold tracking-wide">Enter your credentials below</p>

              <form onSubmit={handleLogin} className="w-full space-y-5 sm:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">Login Email ID</Label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Email"
                      className="!pl-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">Password</Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="!pl-14 !pr-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-teal-700/60 hover:text-teal-900 transition-colors z-10"
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-extrabold transition-all shadow-xl hover:shadow-teal-700/30 mt-4 text-base tracking-wide"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loggin in...
                    </span>
                  ) : (
                    "Log in"
                  )}
                </Button>
              </form>
            </div>

            {/* Sub-card decorative footer area (similar to Instagram layout style) */}
            <div className="text-center py-8">
              <p className="text-[11px] text-teal-950/60 font-extrabold tracking-[0.05em] uppercase">
                © 2026 Students Research Lab. All rights reserved.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
