'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-8 w-24 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] animate-pulse" />
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
    >
      <button
        type="button"
        data-clickable="true"
        onClick={() => setTheme('light')}
        aria-label="Light mode"
        title="Light mode (Anthropic / Stripe Press Alabaster)"
        className={`h-7 px-2 rounded-md text-xs flex items-center justify-center transition-all cursor-pointer ${
          theme === 'light'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-medium'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        data-clickable="true"
        onClick={() => setTheme('system')}
        aria-label="System mode"
        title="System mode (Auto-sync with OS)"
        className={`h-7 px-2 rounded-md text-xs flex items-center justify-center transition-all cursor-pointer ${
          theme === 'system'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-medium'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Laptop className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        data-clickable="true"
        onClick={() => setTheme('dark')}
        aria-label="Dark mode"
        title="Dark mode (Resend / Raycast Obsidian)"
        className={`h-7 px-2 rounded-md text-xs flex items-center justify-center transition-all cursor-pointer ${
          theme === 'dark'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-medium'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
