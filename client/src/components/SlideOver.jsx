import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export default function SlideOver({ isOpen, onClose, title, children, width = 'max-w-md' }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-500" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 backdrop-blur-md" />
        </Transition.Child>
        <div className="fixed inset-0 lg:left-72 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full sm:pl-8">
              <Transition.Child as={Fragment} enter="transform transition ease-in-out duration-500" enterFrom="translate-x-full" enterTo="translate-x-0" leave="transform transition ease-in-out duration-400" leaveFrom="translate-x-0" leaveTo="translate-x-full">
                <Dialog.Panel className={`pointer-events-auto w-screen ${width}`}>
                  <div className="flex h-full flex-col bg-white dark:bg-main shadow-[0_0_100px_rgba(0,0,0,0.5)] border-l border-white/5 relative">
                    <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
                    
                    <div className="flex items-center justify-between px-5 sm:px-8 py-5 sm:py-8 border-b border-black/5 dark:border-white/[0.05] relative z-10">
                      <Dialog.Title className="text-xl font-black dark:text-white text-gray-900 uppercase tracking-tighter">{title}</Dialog.Title>
                      <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-500 hover:border-red-500/50 transition-all group">
                        <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-5 sm:p-8 relative z-10 custom-scrollbar">
                      {children}
                    </div>
                    
                    {/* Decorative bottom element */}
                    <div className="h-1 bg-gradient-to-r from-primary-500/0 via-primary-500/50 to-primary-500/0 opacity-20" />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
