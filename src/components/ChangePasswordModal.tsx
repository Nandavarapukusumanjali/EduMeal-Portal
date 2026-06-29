import React, { useState } from 'react';
import { Key, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { changeCurrentUserPassword } from '../services/auth';

interface ChangePasswordModalProps {
  onClose: () => void;
  isForceChange?: boolean;
}

export default function ChangePasswordModal({ onClose, isForceChange = false }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.trim().length < 6) {
      setErrorMsg('Password PIN must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      await changeCurrentUserPassword(newPassword.trim());
      setSuccessMsg('Your security password PIN was updated successfully!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
      <div className="bg-white max-w-md w-full rounded-2xl border border-outline-variant shadow-lg p-6 space-y-4 animate-scale-up">
        
        <div className="flex items-center gap-3 border-b border-outline-variant pb-3 text-primary">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-headline-md font-bold text-base text-primary">
              {isForceChange ? 'Security Update Required' : 'Change Account Password'}
            </h3>
            <p className="text-[10px] text-on-surface-variant font-light">
              {isForceChange ? 'Secure your account with a personal password' : 'Update your secure system login PIN'}
            </p>
          </div>
        </div>

        {isForceChange && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex gap-2.5 text-xs">
            <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <div>
              <p className="font-bold">First-Time Login Verified</p>
              <p className="text-[10px] text-amber-800 font-light mt-0.5 leading-relaxed">
                As per standard government cybersecurity directives, please replace your school-assigned initial credentials/DOB with a unique secure password.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3 flex gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="font-light">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 flex gap-2 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">
                New Password PIN (6+ characters)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs focus:outline-primary bg-white text-on-surface"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs focus:outline-primary bg-white text-on-surface"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
              {!isForceChange && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={onClose}
                  className="px-4 py-2 border border-outline-variant rounded-lg font-bold text-xs hover:bg-neutral-50 cursor-pointer text-on-surface-variant disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-lg hover:bg-opacity-95 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Updating Credentials...' : 'Secure Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
