'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, Shield } from 'lucide-react';
import { useToast } from './ToastProvider';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export function ChangePasswordModal({ isOpen, onClose, userEmail }: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus current password input on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    if (pass.length < 8) return { score: 1, label: 'Weak (min 8 chars needed)', color: 'text-rose-500 bg-rose-500' };

    let variety = 0;
    if (/[a-z]/.test(pass)) variety++;
    if (/[A-Z]/.test(pass)) variety++;
    if (/[0-9]/.test(pass)) variety++;
    if (/[^a-zA-Z0-9]/.test(pass)) variety++;

    if (pass.length >= 10 && variety >= 3) {
      return { score: 3, label: 'Strong', color: 'text-emerald-500 bg-emerald-500' };
    }
    if (variety >= 2) {
      return { score: 2, label: 'Medium', color: 'text-amber-500 bg-amber-500' };
    }
    return { score: 1, label: 'Weak', color: 'text-rose-500 bg-rose-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (currentPassword && newPassword === currentPassword) {
      setError('New password must be different from current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password');
      }

      toast.success('Password updated successfully! Please use your new password next time.');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error changing password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div
        className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-brand-700 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 id="change-password-title" className="font-bold text-sm">
                Change Account Password
              </h3>
              <p className="text-brand-100 text-[11px]">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current temporary password"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-medium focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-muted hover:text-primary"
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
              New Password (min. 8 characters)
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong new password (min. 8 chars)"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-medium focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-muted hover:text-primary"
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength meter */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted font-medium flex items-center gap-1">
                    <Shield className="w-3 h-3 text-muted" /> Strength:
                  </span>
                  <span className={`font-bold ${strength.color.split(' ')[0]}`}>{strength.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 h-1.5 rounded-full overflow-hidden bg-surface-raised">
                  <div className={`h-full ${strength.score >= 1 ? strength.color.split(' ')[1] : 'bg-transparent'}`} />
                  <div className={`h-full ${strength.score >= 2 ? strength.color.split(' ')[1] : 'bg-transparent'}`} />
                  <div className={`h-full ${strength.score >= 3 ? strength.color.split(' ')[1] : 'bg-transparent'}`} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-medium focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-border hover:bg-surface-hover font-bold text-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || newPassword.length < 8}
              className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center gap-1.5"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
