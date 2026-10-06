import React from 'react';

export const LoginVisualCard = () => {
  return (
    <div 
      id="login-visual-card"
      className="hidden lg:flex relative w-full h-full min-h-[460px] rounded-2xl bg-slate-900 border border-slate-200/20 dark:border-slate-800 shadow-2xl overflow-hidden group select-none"
    >
      {/* Decorative Subtle Glowing Background Ring */}
      <div className="absolute -inset-1.5 bg-gradient-to-r from-sky-500/20 via-cyan-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-90 transition duration-500" />

      {/* Main Image Container */}
      <div className="relative w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center rounded-2xl border border-slate-800/80">
        <img
          src="/login_visual.jpg"
          alt="WealthTrack Pro Portfolio & Investment Intelligence Visual"
          id="login-auth-visual-img"
          className="w-full h-full object-cover object-center transform group-hover:scale-[1.02] transition-transform duration-700 ease-out"
          loading="eager"
        />

        {/* Subtle Gradient Vignette Overlay for Depth & Theme Harmony */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/20 pointer-events-none" />
      </div>
    </div>
  );
};

