import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useRealtime } from '../hooks/useRealtime';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScroll, setShowScroll]   = useState(false);
  const mainRef     = useRef(null);
  const intervalRef = useRef(null);
  const holdTimeout = useRef(null);
  useRealtime();

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowScroll(el.scrollTop > 120);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Single click: jump 380px
  const scrollBy = (dir) => mainRef.current?.scrollBy({ top: dir * 380, behavior: 'smooth' });

  // Long-press: continuously scroll every 16ms (~60fps) while held
  const startHold = useCallback((dir) => {
    // Small delay before auto-scroll kicks in (distinguishes tap from hold)
    holdTimeout.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        mainRef.current?.scrollBy({ top: dir * 18, behavior: 'instant' });
      }, 16);
    }, 300);
  }, []);

  const stopHold = useCallback(() => {
    clearTimeout(holdTimeout.current);
    clearInterval(intervalRef.current);
  }, []);

  // Shared press props for a given direction
  const pressProps = (dir) => ({
    onMouseDown:  () => startHold(dir),
    onMouseUp:    stopHold,
    onMouseLeave: stopHold,
    onTouchStart: (e) => { e.preventDefault(); startHold(dir); },
    onTouchEnd:   stopHold,
    onTouchCancel:stopHold,
    onClick:      () => scrollBy(dir),
  });

  return (
    <div className="flex h-screen overflow-hidden bg-main">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>

        {/* ── Global floating scroll buttons ── */}
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col gap-2 z-50 select-none">
          <button
            {...pressProps(-1)}
            title="Scroll up (hold to auto-scroll)"
            className={`w-9 h-9 flex items-center justify-center rounded-xl backdrop-blur-sm border shadow-lg transition-all duration-300 active:scale-95 ${
              showScroll
                ? 'bg-primary-500/90 border-primary-400/50 text-white hover:bg-primary-600 shadow-primary-500/30 opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none bg-primary-500/90 border-primary-400/50 text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            {...pressProps(1)}
            title="Scroll down (hold to auto-scroll)"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-500/80 dark:bg-black/60 backdrop-blur-sm border border-primary-400/40 dark:border-white/20 text-white hover:bg-primary-500 dark:hover:bg-primary-500 hover:border-primary-400/70 dark:hover:border-primary-400/50 shadow-lg shadow-primary-500/20 transition-all duration-200 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
