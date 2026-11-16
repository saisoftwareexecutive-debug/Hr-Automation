'use client';

import React from 'react';
import { User, Shield, Mail, Clock, KeyRound, LogOut, X, CheckCircle2 } from 'lucide-react';
import { SessionData } from '@/lib/auth';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SessionData | null;
  onLogout: () => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  onLogout,
}: UserProfileModalProps) {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-6 bg-gradient-to-tr from-brand-800 to-indigo-600 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-xl shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">{user.name}</h3>
              <p className="text-brand-100 text-xs mt-0.5">{user.email}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white border border-white/30">
                <Shield className="w-3 h-3" />
                {user.role === 'admin' ? 'Administrator' : 'HR Executive'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface-subtle rounded-2xl border border-border">
              <span className="text-[10px] font-bold uppercase text-muted block">Account Status</span>
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </div>
            </div>

            <div className="p-3 bg-surface-subtle rounded-2xl border border-border">
              <span className="text-[10px] font-bold uppercase text-muted block">Inactivity Limit</span>
              <div className="flex items-center gap-1.5 text-primary font-bold mt-1">
                <Clock className="w-3.5 h-3.5 text-muted" /> 30 Minutes
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-bold transition mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out of HireFlow</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

