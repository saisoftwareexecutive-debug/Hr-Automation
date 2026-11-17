'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Briefcase,
  Upload,
  LayoutDashboard,
  KanbanSquare,
  Clock,
  Send,
  FileText,
  ShieldAlert,
  Menu,
  X,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If viewing candidate public apply form, do not show HR admin navbar
  if (pathname.startsWith('/apply/')) {
    return null;
  }

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Pipeline Board', href: '/pipeline', icon: KanbanSquare },
    { label: 'Candidates', href: '/candidates', icon: Users },
    { label: 'Jobs & Rules', href: '/jobs', icon: Briefcase },
    { label: 'WorkIndia Import', href: '/import', icon: Upload },
    { label: 'Batch Send', href: '/batch-send', icon: Send },
    { label: 'Follow-ups (24h)', href: '/followups', icon: Clock },
    { label: 'Templates', href: '/templates', icon: FileText },
    { label: 'Audit Log', href: '/audit', icon: ShieldAlert },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-brand-500/20">
                HF
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-gray-900">
                    Hire<span className="text-brand-600">Flow</span>
                  </span>
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                    🇮🇳 IN
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">WorkIndia HR Automation</p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-gray-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Action Buttons & Profile */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/import"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              Upload WorkIndia
            </Link>

            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Post Job
            </Link>

            <div className="h-6 w-px bg-gray-200 mx-1"></div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                CS
              </div>
              <div className="text-left text-xs leading-tight">
                <span className="font-bold text-gray-800 block">Alex</span>
                <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-indigo-100 text-indigo-700 rounded">
                  Admin
                </span>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex xl:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-b border-gray-200 px-4 pt-2 pb-4 space-y-1 shadow-lg animate-in slide-in-from-top-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4 text-brand-600" />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
            <Link
              href="/import"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg"
            >
              <Upload className="w-4 h-4" /> Upload WorkIndia Excel
            </Link>
            <Link
              href="/jobs/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-lg"
            >
              <PlusCircle className="w-4 h-4" /> Post New Job
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

