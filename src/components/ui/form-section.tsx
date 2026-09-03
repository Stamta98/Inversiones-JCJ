"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

/**
 * A section of a long form that starts folded up.
 *
 * A twenty field form asks the same thing of everyone: scroll past what you do
 * not need. Folded sections put the handful of required fields on screen and
 * leave the rest one tap away, which is what makes the form usable standing at
 * a customer's door on a phone.
 *
 * The one rule that matters: a section holding a rejected field opens itself,
 * whether the browser rejected it or the server did. An error nobody can see is
 * worse than a long form — and a folded invalid field is worse still, because
 * the browser refuses to submit and cannot say why.
 */
export function FormSection({
  icon,
  title,
  hint,
  defaultOpen = false,
  hasError = false,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  /** True when something inside failed validation. */
  hasError?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasError) setOpen(true);
  }, [hasError]);

  useEffect(() => {
    const node = contentRef.current;
    const form = node?.closest("form");
    if (!node || !form) return;

    const reveal = (event: Event) => {
      if (!node.contains(event.target as Node)) return;
      // Unfold now, not on the next render: the browser is about to focus this
      // control to report the problem, and it cannot focus a hidden one.
      node.hidden = false;
      setOpen(true);
    };

    // "invalid" does not bubble, so it has to be caught on the way down.
    form.addEventListener("invalid", reveal, true);
    return () => form.removeEventListener("invalid", reveal, true);
  }, []);

  return (
    <section className="overflow-hidden rounded-[--radius-card] border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-muted"
      >
        <span
          className={[
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            hasError
              ? "bg-danger-soft text-danger"
              : "bg-brand-soft text-brand-strong",
          ].join(" ")}
        >
          <Icon name={icon} size={16} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{title}</span>
          {hint ? (
            <span className="block text-xs text-ink-subtle">{hint}</span>
          ) : null}
        </span>

        <Icon
          name="chevron-down"
          size={18}
          className={[
            "shrink-0 text-ink-muted transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {/* Kept in the DOM while folded: the fields still submit, and a browser
          can still jump to one it wants to report on. */}
      <div
        id={contentId}
        ref={contentRef}
        hidden={!open}
        className="border-t border-border"
      >
        {children}
      </div>
    </section>
  );
}
