import clsx from "clsx";

export default function PremiumIcon({ children, className }) {
    return (
        <span
            className={clsx(
                `
          h-11 w-11 inline-flex items-center justify-center
          rounded-2xl border
          border-slate-200/60 dark:border-white/10
          bg-gradient-to-br from-sky-500/12 via-indigo-500/10 to-fuchsia-500/10
          shadow-[0_12px_28px_rgba(59,130,246,0.12)]
          text-[20px]
        `,
                className
            )}
        >
            {children}
        </span>
    );
}
