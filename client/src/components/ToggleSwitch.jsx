export default function ToggleSwitch({ checked, onChange, disabled = false, size = 'md' }) {
  const sizes = {
    sm: { track: 'w-9 h-5',  knob: 'w-4 h-4',  on: 'translate-x-[18px]', off: 'translate-x-0.5' },
    md: { track: 'w-12 h-6', knob: 'w-5 h-5',  on: 'translate-x-[26px]', off: 'translate-x-0.5' },
    lg: { track: 'w-14 h-7', knob: 'w-6 h-6',  on: 'translate-x-[30px]', off: 'translate-x-0.5' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${s.track} ${
        checked
          ? 'bg-primary-500 shadow-[0_0_12px_rgba(139,92,246,0.40)]'
          : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`${s.knob} pointer-events-none inline-block rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
          checked ? s.on : s.off
        }`}
      />
    </button>
  );
}
