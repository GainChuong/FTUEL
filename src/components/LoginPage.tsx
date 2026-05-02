import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, UserPlus, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error: authError } = await signIn(email, password);
      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng.'
          : authError.message);
      }
    } else {
      const { error: authError } = await signUp(email, password);
      if (authError) {
        setError(authError.message);
      } else {
        setSuccess('Đăng ký thành công! Kiểm tra email để xác nhận tài khoản, hoặc đăng nhập ngay nếu không cần xác nhận.');
        setIsLogin(true);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)' }}
    >
      <style>{`
        input::-ms-reveal,
        input::-ms-clear {
          display: none;
        }
        input::-webkit-contacts-auto-fill-button,
        input::-webkit-credentials-auto-fill-button {
          visibility: hidden;
          display: none !important;
          pointer-events: none;
        }
      `}</style>
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #30E9CD 0%, transparent 70%)',
            top: '-10%',
            right: '-5%',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 30, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #30E9CD 0%, transparent 70%)',
            bottom: '-15%',
            left: '-10%',
          }}
          animate={{
            x: [0, -30, 20, 0],
            y: [0, 20, -30, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[250px] h-[250px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)',
            top: '40%',
            left: '30%',
          }}
          animate={{
            x: [0, 40, -10, 0],
            y: [0, -30, 20, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Glass card */}
        <div
          className="rounded-3xl p-6 shadow-2xl border border-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #30E9CD 0%, #20c4ab 100%)' }}
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.7)" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.7)" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.7)" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.7)" />
                <circle cx="10" cy="14" r="2" fill="white" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              GraphRetail <span style={{ color: '#30E9CD' }}>AI</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 font-medium">
              Competitive Intelligence & Simulation
            </p>
          </motion.div>

          {/* Tab toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex rounded-xl p-1 mb-6"
            style={{ background: 'rgba(255, 255, 255, 0.06)' }}
          >
            <button
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                isLogin
                  ? 'text-slate-900 shadow-md'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              style={isLogin ? { background: '#30E9CD' } : {}}
            >
              <LogIn size={15} />
              Đăng nhập
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                !isLogin
                  ? 'text-slate-900 shadow-md'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              style={!isLogin ? { background: '#30E9CD' } : {}}
            >
              <UserPlus size={15} />
              Đăng ký
            </button>
          </motion.div>

          {/* Error / Success */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-4 p-3 rounded-xl flex items-start gap-2.5 text-sm border border-red-500/30"
                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
              >
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-red-300">{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-4 p-3 rounded-xl flex items-start gap-2.5 text-sm border"
                style={{ background: 'rgba(48, 233, 205, 0.1)', borderColor: 'rgba(48, 233, 205, 0.3)' }}
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#30E9CD' }} />
                <span style={{ color: '#30E9CD' }}>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 border border-white/10 outline-none transition-all duration-200 focus:border-[#30E9CD]/60 focus:ring-1 focus:ring-[#30E9CD]/30"
                  style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 border border-white/10 outline-none transition-all duration-200 focus:border-[#30E9CD]/60 focus:ring-1 focus:ring-[#30E9CD]/30"
                  style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (signup only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 border border-white/10 outline-none transition-all duration-200 focus:border-[#30E9CD]/60 focus:ring-1 focus:ring-[#30E9CD]/30"
                      style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-slate-900 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed mt-6"
              style={{
                background: loading
                  ? 'rgba(48, 233, 205, 0.5)'
                  : 'linear-gradient(135deg, #30E9CD 0%, #20c4ab 100%)',
                boxShadow: loading
                  ? 'none'
                  : '0 4px 20px rgba(48, 233, 205, 0.3)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          {/* Footer text */}
          <p className="text-center text-xs text-slate-500 mt-6">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}
              className="font-semibold hover:underline cursor-pointer transition-colors"
              style={{ color: '#30E9CD' }}
            >
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>

        {/* Brand footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-slate-600 mt-6"
        >
          Powered by <span className="font-semibold text-slate-500">GraphRetail AI</span> &mdash; Competitive Intelligence Platform
        </motion.p>
      </motion.div>
    </div>
  );
}
