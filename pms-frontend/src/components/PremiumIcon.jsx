import clsx from "clsx";

export default function PremiumIcon({ children, className }) {
  return (
    <span
      className={clsx(
        `
          relative inline-flex h-12 w-12 items-center justify-center overflow-hidden
          rounded-[20px] border border-slate-200/70 dark:border-white/10
          bg-gradient-to-br from-white via-sky-50 to-cyan-100/80
          text-[21px] shadow-[0_16px_32px_rgba(14,165,233,0.16)]
          dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-800
        `,
        className
      )}
    >
      <span className="pointer-events-none absolute inset-[1px] rounded-[18px] bg-gradient-to-br from-white/90 via-white/35 to-transparent dark:from-white/10 dark:via-white/5 dark:to-transparent" />
      <span className="pointer-events-none absolute -right-3 -top-3 h-8 w-8 rounded-full bg-sky-400/25 blur-xl dark:bg-sky-500/20" />
      <span className="relative z-[1] drop-shadow-[0_3px_8px_rgba(15,23,42,0.12)]">
        {children}
      </span>
    </span>
  );
}
