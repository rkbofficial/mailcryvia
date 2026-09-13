import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function TopBar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-20 glass flex items-center justify-between px-4 lg:px-8 shrink-0 z-20 transition-all duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="hidden sm:block relative group">
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-72 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl py-2.5 px-12 text-xs font-bold tracking-widest focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2 group-focus-within:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-focus-within:opacity-100 transition-opacity">
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[8px] font-black text-gray-400 border border-black/5 dark:border-white/5">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[8px] font-black text-gray-400 border border-black/5 dark:border-white/5">K</kbd>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:border-primary-500/50 transition-all group"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 group-hover:rotate-45 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
          ) : (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 group-hover:-rotate-12 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-black tracking-widest uppercase">{user?.email?.split('@')[0]}</span>
            <span className="text-[8px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
              Authenticated
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-primary-500 text-white rounded-xl sm:rounded-2xl flex items-center justify-center text-sm font-black shadow-xl shadow-primary-500/20 group-hover:scale-110 transition-all duration-500">
            {user?.email?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all duration-500 group"
          title="Logout"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
    </header>
  );
}
