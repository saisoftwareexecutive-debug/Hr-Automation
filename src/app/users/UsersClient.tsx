'use client';

import React, { useState } from 'react';
import { User, UserRole } from '@/types';
import { SessionData } from '@/lib/auth';
import {
  UserCheck,
  Plus,
  KeyRound,
  Shield,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Edit2,
  X,
  Lock,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

interface UsersClientProps {
  initialUsers: Omit<User, 'password_hash'>[];
  currentUser: SessionData;
}

export function UsersClient({ initialUsers, currentUser }: UsersClientProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<Omit<User, 'password_hash'>[]>(initialUsers);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Omit<User, 'password_hash'> | null>(null);

  // Temp Password display dialog
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    isOpen: boolean;
    email: string;
    tempPass: string;
  }>({ isOpen: false, email: '', tempPass: '' });

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add User Form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('hr_executive');

  // Edit User Form state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('hr_executive');
  const [editActive, setEditActive] = useState(true);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Temporary password copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Add User Handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, full_name: newName, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      setUsers((prev) => [...prev, data.user]);
      setIsAddOpen(false);
      setNewName('');
      setNewEmail('');

      // Show temporary password modal
      setTempPasswordModal({
        isOpen: true,
        email: data.user.email,
        tempPass: data.tempPassword,
      });

      toast.success(`User ${data.user.full_name} created successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Error creating user');
    } finally {
      setLoading(false);
    }
  };

  // Edit User Handler
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: editName, role: editRole, is_active: editActive }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user');
      }

      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? data.user : u)));
      setIsEditOpen(false);
      setSelectedUser(null);
      toast.success('User updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (user: Omit<User, 'password_hash'>) => {
    if (!confirm(`Are you sure you want to reset password for ${user.full_name} (${user.email})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setTempPasswordModal({
        isOpen: true,
        email: user.email,
        tempPass: data.tempPassword,
      });

      toast.success(`Password for ${user.full_name} has been reset.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (u: Omit<User, 'password_hash'>) => {
    if (u.id === currentUser.userId) {
      toast.error('Cannot delete the currently logged-in user account.');
      return;
    }

    if (u.role === 'admin') {
      const otherAdmins = users.filter((x) => x.role === 'admin' && x.is_active && x.id !== u.id);
      if (otherAdmins.length === 0) {
        toast.error('Cannot delete the last remaining Admin account.');
        return;
      }
    }

    if (
      !confirm(
        `Are you sure you want to permanently delete user "${u.full_name}" (${u.email})? Note: Users with recorded activity in the system cannot be deleted and must be deactivated instead.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`User "${u.full_name}" deleted successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Error deleting user');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            HR Team &amp; User Access Control
          </h1>
          <p className="text-sm text-secondary mt-1">
            Manage recruiter accounts, assign Admin vs HR Executive roles, and generate temporary credentials with zero external email dependencies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add HR User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-border">
            <thead className="bg-surface-subtle text-muted font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.userId;

                return (
                  <tr key={u.id} className="hover:bg-surface-hover transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-subtle text-brand font-bold flex items-center justify-center shrink-0 border border-brand/20">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-primary flex items-center gap-2">
                            {u.full_name}
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-brand-subtle text-brand">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {u.role === 'admin' ? 'Administrator' : 'HR Executive'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Deactivated
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-muted">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never logged in'}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setEditName(u.full_name);
                            setEditRole(u.role);
                            setEditActive(u.is_active);
                            setIsEditOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-secondary transition"
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResetPassword(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 font-bold text-[11px] transition"
                          title="Generate Temporary Password"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reset Password</span>
                        </button>

                        {u.id !== currentUser.userId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-900 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 transition"
                            title="Delete User (Users with recorded activity cannot be deleted)"
                            aria-label="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Compliance Notice */}
        <div className="p-3.5 bg-surface-subtle border-t border-border flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-muted">
          <span>🛡️ Audit logs and historical trails are immutable for DPDP Act compliance.</span>
          <span>Accounts with recorded activity must be deactivated rather than deleted.</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD HR USER */}
      {/* ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-brand text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add New HR Team Member</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-white/80 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ananya Deshmukh"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ananya@company.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
                  Role &amp; Permissions
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                >
                  <option value="hr_executive">HR Executive (Can screen, import, send WhatsApp, view pipeline)</option>
                  <option value="admin">Admin (Full access: Users, Settings, Scoring, Templates, Audit)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-secondary hover:bg-surface-hover font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold transition shadow-xs"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT USER */}
      {/* ======================================================== */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-surface-raised border-b border-border text-primary flex items-center justify-between">
              <h3 className="font-bold text-sm">Edit User: {selectedUser.email}</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-muted hover:text-primary p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                >
                  <option value="hr_executive">HR Executive</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-secondary">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="w-4 h-4 text-brand rounded border-border"
                  />
                  <span>Account Active (Uncheck to deactivate user login)</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-secondary hover:bg-surface-hover font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold transition shadow-xs"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: TEMPORARY CREDENTIALS DISPLAY */}
      {/* ======================================================== */}
      {tempPasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-primary">Temporary Credentials Generated</h3>
              <p className="text-xs text-muted">
                Share these credentials with the user. They will be forced to change this password on their first login.
              </p>
            </div>

            <div className="bg-surface-subtle rounded-2xl p-4 border border-border space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">User Email</span>
                <span className="font-mono font-bold text-primary">{tempPasswordModal.email}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Temporary Password</span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono font-extrabold text-brand text-base">
                    {tempPasswordModal.tempPass}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(tempPasswordModal.tempPass)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-subtle text-brand border border-brand/20 font-bold transition hover:bg-brand/20"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTempPasswordModal({ isOpen: false, email: '', tempPass: '' })}
              className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs transition shadow-xs"
            >
              Done &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

