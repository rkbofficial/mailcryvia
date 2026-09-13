export default function StatCard({ label, value, icon, color = 'purple', sub, compact = false }) {
  const colorMap = {
    blue:   'bg-violet-400/10 text-violet-300 border-violet-400/20',
    green:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
    purple: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    orange: 'bg-purple-400/10 text-purple-300 border-purple-400/20',
    red:    'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <div className={`card group hover:border-primary-500/30 transition-all duration-500 relative overflow-hidden ${compact ? 'p-4' : 'p-8'}`}>
      {!compact && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-all duration-700" />
      )}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <p className={`font-black text-gray-500 uppercase leading-tight ${compact ? 'text-[9px] tracking-[0.1em] mb-1.5' : 'text-[10px] tracking-[0.2em] mb-3'}`}>{label}</p>
          <p className={`font-black dark:text-white text-gray-900 tracking-tighter group-hover:text-primary-500 transition-colors text-mono leading-none ${compact ? 'text-2xl' : 'text-3xl xl:text-4xl'}`}>{value}</p>
          {sub && (
            <div className={`flex items-center gap-1.5 ${compact ? 'mt-2' : 'mt-5'}`}>
              <span className={`font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-xl shadow-lg shadow-violet-500/5 ${compact ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'}`}>{sub}</span>
              <span className="text-[9px] text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest">Rate</span>
            </div>
          )}
        </div>
        {icon && !compact && (
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border ${colorMap[color]} shadow-2xl group-hover:scale-110 group-hover:rotate-[10deg]`}>
            <div className="group-hover:drop-shadow-[0_0_12px_currentColor] transition-all">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
