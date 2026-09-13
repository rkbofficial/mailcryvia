import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [account, setAccount] = useState({ email: user?.email || '', current_password: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  useEffect(() => {
    if (!settingsData) return;
    setAppBaseUrl(settingsData.app_base_url ?? '');
  }, [settingsData]);

  useEffect(() => {
    setAccount((prev) => ({ ...prev, email: user?.email || '' }));
  }, [user?.email]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/settings', { app_base_url: appBaseUrl });
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings Saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save Failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      toast.error('Passwords do not match'); return;
    }
    try {
      await api.put('/settings/password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      toast.success('Password Updated');
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update Failed');
    }
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/users/me', account);
      updateUser(res.data.user);
      setAccount((prev) => ({ ...prev, current_password: '' }));
      toast.success('Account email updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Account update failed');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/users/me', { data: { current_password: deletePassword } });
      toast.success('User account deleted');
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setShowDeleteAccount(false);
      setDeletePassword('');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-12 pb-24 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Settings</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Configure your account and platform</p>
        </div>
        <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-primary">
          {savingSettings ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="card p-8 space-y-6">
          <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest border-l-4 border-amber-500 pl-3">General Settings</h2>
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">App Base URL</label>
            <input value={appBaseUrl} onChange={e => setAppBaseUrl(e.target.value)} className="input-field text-mono" placeholder="https://yourapp.com" />
            <p className="text-[9px] text-primary-500 mt-2 uppercase font-black tracking-widest">Used for tracking and unsubscribe links</p>
          </div>
        </div>

        {/* Email Senders link */}
        <div className="card p-8 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest border-l-4 border-primary-500 pl-3 mb-3">Email Accounts</h2>
            <p className="text-sm text-gray-500 leading-relaxed">Manage your SMTP email accounts used for sending campaigns from the Email Senders page.</p>
          </div>
          <button onClick={() => navigate('/email-integrations')} className="btn-secondary">Go to Email Senders →</button>
        </div>

        {/* User Account */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleUpdateAccount} className="card p-8 space-y-6">
            <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest border-l-4 border-blue-500 pl-3">User Account</h2>
            <div>
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Login Email</label>
              <input type="email" value={account.email} onChange={e => setAccount({...account, email: e.target.value})} className="input-field" required />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Current Password</label>
              <input type="password" value={account.current_password} onChange={e => setAccount({...account, current_password: e.target.value})} className="input-field" required autoComplete="current-password" />
              <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-2 font-bold uppercase tracking-widest">Required before changing your login email</p>
            </div>
            <button type="submit" className="btn-secondary">UPDATE ACCOUNT</button>
          </form>

          <div className="card p-8 space-y-6 border-red-500/20">
            <h2 className="text-sm font-black text-red-500 uppercase tracking-widest border-l-4 border-red-500 pl-3">Delete User</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-6">
              Delete your account and remove or anonymize personal data tied to it. This action cannot be undone.
            </p>
            <div>
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Current Password</label>
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className="input-field" autoComplete="current-password" />
            </div>
            <button
              type="button"
              className="btn-danger"
              disabled={!deletePassword}
              onClick={() => setShowDeleteAccount(true)}
            >
              DELETE USER
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="lg:col-span-2 card p-5 sm:p-10 bg-black/20 border-primary-500/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-lg font-black dark:text-white text-gray-900 uppercase tracking-widest">Update Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Current Password</label><input type="password" value={passwords.current_password} onChange={e => setPasswords({...passwords, current_password: e.target.value})} className="input-field" required /></div>
              <div><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">New Password</label><input type="password" value={passwords.new_password} onChange={e => setPasswords({...passwords, new_password: e.target.value})} className="input-field" required /></div>
              <div><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Confirm Password</label><input type="password" value={passwords.confirm_password} onChange={e => setPasswords({...passwords, confirm_password: e.target.value})} className="input-field" required /></div>
            </div>
            <button type="submit" className="btn-secondary">UPDATE PASSWORD</button>
          </form>
        </div>
      </div>

      <ConfirmModal isOpen={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} onConfirm={handleDeleteAccount} title="Delete User?" message="This removes or anonymizes personal data tied to your account and cannot be undone." confirmText="DELETE USER" variant="danger" />
    </div>
  );
}
