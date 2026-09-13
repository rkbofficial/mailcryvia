import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'danger' }) {
  const btnClass = variant === 'danger' 
    ? 'bg-red-500 hover:bg-red-600 text-white border-red-400' 
    : 'btn-primary';

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 backdrop-blur-xl" />
        </Transition.Child>
        <div className="fixed inset-0 lg:left-72 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md bg-main border border-white/10 rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 shadow-[0_0_100px_rgba(139,92,246,0.15)] relative overflow-hidden">
                <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />
                <div className="relative z-10">
                  <Dialog.Title className="text-xl font-black dark:text-white text-gray-900 tracking-tighter">{title}</Dialog.Title>
                  <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
                  <div className="mt-10 flex gap-4">
                    <button className="btn-secondary flex-1 justify-center" onClick={onClose}>CANCEL</button>
                    <button className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] border shadow-xl transition-all ${btnClass}`} onClick={onConfirm}>
                      {confirmText}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
