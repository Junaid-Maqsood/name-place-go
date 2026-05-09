// Pill-style dark/light toggle
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ dark, onChange }: { dark: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => onChange(!dark)}
      className="relative inline-flex h-9 w-[72px] items-center rounded-full border-2 border-foreground/30 bg-card transition-colors shadow-[3px_3px_0_0_hsl(var(--foreground)/0.15)]"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="absolute left-1.5 text-amber-500">
        <Sun className="size-4" />
      </span>
      <span className="absolute right-1.5 text-indigo-400">
        <Moon className="size-4" />
      </span>
      <span
        className={`relative z-10 inline-block size-7 rounded-full bg-primary border-2 border-foreground/40 transition-transform duration-200 ${
          dark ? "translate-x-[37px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
