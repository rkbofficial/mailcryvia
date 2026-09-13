import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

const mainNavItems = [
  { to: '/dashboard',   label: 'Dashboard',   icon: DashboardIcon  },
  { to: '/contacts',    label: 'Contacts',     icon: ContactsIcon   },
  { to: '/lists',       label: 'Lists',        icon: ListsIcon      },
  { to: '/templates',   label: 'Templates',    icon: TemplatesIcon  },
  { to: '/campaigns',   label: 'Campaigns',    icon: CampaignsIcon  },
  { to: '/automations', label: 'Automations', icon: AutomationsIcon },
  { to: '/analytics',   label: 'Analytics',   icon: AnalyticsIcon   },
];

const accountNavItems = [
  { to: '/plans',              label: 'Plans',          icon: PlansIcon            },
  { to: '/billing',            label: 'Billing',        icon: BillingIcon          },
  { to: '/email-integrations', label: 'Email Senders',  icon: EmailSendersIcon     },
  { to: '/settings',           label: 'Settings',       icon: SettingsIcon         },
];

const PLAN_BADGES = {
  free:         'dark:text-violet-400/70 text-violet-600 dark:border-violet-500/25 border-violet-400/40',
  professional: 'dark:text-violet-400 text-violet-700 dark:border-violet-500/40 border-violet-500/50',
  business:     'dark:text-violet-300 text-violet-700 dark:border-violet-400/40 border-violet-400/50',
  enterprise:   'dark:text-purple-200 text-purple-700 dark:border-purple-300/40 border-purple-500/50',
};

export default function Sidebar({ isOpen, setIsOpen }) {
  const { theme } = useTheme();
  const { user } = useAuth();

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/subscriptions/current').then(r => r.data),
    staleTime: 60000,
  });

  const planName = billing?.plan?.name || 'Free';
  const planSlug = billing?.plan?.slug || 'free';
  const dailySent  = billing?.dailySent || 0;
  const dailyLimit = billing?.plan?.recipients_per_day ?? 200;
  const usagePct   = dailyLimit === -1 ? 0 : Math.min(100, Math.round((dailySent / (dailyLimit || 1)) * 100));
  const badgeClass = PLAN_BADGES[planSlug] || PLAN_BADGES.free;

  const NavItem = ({ item }) => (
    <NavLink
      to={item.to}
      onClick={() => setIsOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-colors duration-200 group relative overflow-hidden ${
          isActive
            ? 'nav-link-active'
            : 'dark:text-gray-400 text-gray-600 hover:text-primary-600 dark:hover:text-white hover:bg-violet-50 dark:hover:bg-white/5'
        }`
      }
    >
      <item.icon className="w-5 h-5 shrink-0 transition-colors duration-200" />
      <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
    </NavLink>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-[#0d0928]/85 backdrop-blur-md z-40 lg:hidden transition-opacity duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      <aside className={`fixed lg:static inset-y-0 left-0 w-72 flex flex-col shrink-0 z-50 transition-transform duration-300 ease-out border-r [backface-visibility:hidden] lg:transform-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${
        theme === 'dark'
          ? 'bg-[#0d0928] border-violet-700/30'
          : 'bg-[#f5f2ff] border-violet-200/60 shadow-2xl'
      }`}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.06] tech-grid" />

        {/* Brand */}
        <div className="h-20 flex items-center px-6 relative z-10 justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 border border-primary-400/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-black dark:text-white text-gray-900 tracking-widest uppercase leading-none">Mailcry<span className="text-primary-400">Via</span></span>
              <span className="text-[10px] font-bold text-primary-400 uppercase tracking-[0.2em] mt-0.5 block opacity-70">Professional Suite</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-primary-500 hover:bg-white/10 transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Plan badge */}
        <div className="px-5 pb-3 relative z-10">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${badgeClass} dark:bg-white/[0.03] bg-violet-100/50`}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z"/></svg>
            <span className="text-xs font-black uppercase tracking-widest">{planName} Plan</span>
            {dailyLimit !== -1 && (
              <span className="ml-auto text-xs font-black opacity-70">{dailySent}/{dailyLimit}</span>
            )}
          </div>
          {dailyLimit !== -1 && usagePct > 0 && (
            <div className="h-1 bg-violet-200/50 dark:bg-white/5 rounded-full overflow-hidden mt-1.5">
              <div className={`h-full rounded-full ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-violet-300' : 'bg-primary-500'}`} style={{ width: `${usagePct}%` }} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-3 overflow-y-auto relative z-10 custom-scrollbar space-y-0.5">
          <p className="text-[11px] font-black dark:text-gray-500 text-violet-500/80 uppercase tracking-[0.25em] px-3 pt-2 pb-1.5">Menu</p>
          {mainNavItems.map(item => <NavItem key={item.to} item={item} />)}

          <p className="text-[11px] font-black dark:text-gray-500 text-violet-500/80 uppercase tracking-[0.25em] px-3 pt-5 pb-1.5">Account</p>
          {accountNavItems.map(item => <NavItem key={item.to} item={item} />)}

          {user?.role === 'admin' && (
            <>
              <p className="text-[11px] font-black text-amber-600/80 uppercase tracking-[0.25em] px-3 pt-5 pb-1.5">Admin</p>
              <NavLink
                to="/admin"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-colors duration-200 group ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'text-amber-600 hover:text-amber-400 hover:bg-amber-500/5'
                  }`
                }
              >
                <AdminIcon className="w-5 h-5 shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest">Admin Panel</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* System Status */}
        <div className="p-4 border-t border-violet-200/50 dark:border-white/5 relative z-10 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black dark:text-gray-500 text-gray-600 uppercase tracking-widest">Service Status</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"></span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="dark:bg-white/5 bg-violet-100/60 rounded-xl p-2 dark:border-white/5 border border-violet-200/60">
              <p className="text-[10px] font-bold dark:text-gray-500 text-gray-600 uppercase tracking-tighter">Response</p>
              <p className="text-xs font-black text-primary-500 font-mono mt-0.5">24ms</p>
            </div>
            <div className="dark:bg-white/5 bg-violet-100/60 rounded-xl p-2 dark:border-white/5 border border-violet-200/60">
              <p className="text-[10px] font-bold dark:text-gray-500 text-gray-600 uppercase tracking-tighter">Uptime</p>
              <p className="text-xs font-black text-primary-500 font-mono mt-0.5">99.9%</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────── */
function DashboardIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>;
}
function ContactsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>;
}
function ListsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>;
}
function TemplatesIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>;
}
function CampaignsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>;
}
function AutomationsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
}
function AnalyticsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>;
}
function SettingsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
}
function PlansIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>;
}
function BillingIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>;
}
function EmailSendersIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z"/></svg>;
}
function AdminIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z"/></svg>;
}
