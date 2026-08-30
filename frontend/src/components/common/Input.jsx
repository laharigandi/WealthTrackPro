import React, { useId } from 'react';

export const Input = ({ label, error, icon: Icon, rightElement, ...props }) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-base font-medium text-slate-900 dark:text-slate-100">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <Icon size={16} />
          </span>
        )}
        <input
          id={id}
          className={`w-full py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-all duration-200
            focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400
            ${error ? 'border-red-600 dark:border-red-400' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'}
            ${Icon ? 'pl-10' : 'px-3.5'}
            ${rightElement ? 'pr-10' : 'pr-3.5'}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            {rightElement}
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</span>}
    </div>
  );
};
