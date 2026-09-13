export default function LoadingSpinner({ size = 'md' }) {
  const sizeClasses = { 
    sm: 'w-6 h-6 border-2', 
    md: 'w-12 h-12 border-4', 
    lg: 'w-20 h-20 border-[6px]' 
  };
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <div className="relative">
        <div className={`${sizeClasses[size]} animate-spin rounded-[1rem] border-primary-500/10 border-t-primary-500 shadow-[0_0_20px_rgba(139,92,246,0.3)]`} />
        <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />
      </div>
      <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.4em] animate-pulse">Loading...</p>
    </div>
  );
}
