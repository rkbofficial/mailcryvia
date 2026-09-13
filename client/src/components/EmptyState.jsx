export default function EmptyState({ icon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 animate-fade-in relative overflow-hidden">
      <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
      <div className="w-24 h-24 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl relative group">
        <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-all duration-1000" />
        {icon || (
          <svg className="w-10 h-10 text-primary-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      <h3 className="text-xl font-black dark:text-white text-gray-900 mb-3 uppercase tracking-[0.3em]">{title}</h3>
      <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-10 text-center max-w-sm font-black uppercase tracking-widest leading-[1.8]">{description}</p>
      {action && (
        <button className="btn-primary py-4 px-8" onClick={action}>
          {actionLabel || 'GET STARTED'}
        </button>
      )}
    </div>
  );
}
