"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";

/**
 * Runs a server action from a form and keeps its returned state.
 *
 * This replaces React's `useActionState` + `<form action={...}>`. With that
 * pairing, a form whose action returns a value instead of redirecting stops
 * submitting after the first attempt: the browser never fires a second
 * request, so a user who mistypes anything is stuck until they reload. Calling
 * the action inside a transition sidesteps the form action queue entirely, so
 * every attempt is a real submission.
 *
 * A server action that redirects still works: the redirect is handled by the
 * router and the promise never resolves with a state.
 *
 * Every form using this must set `method="post"`. Until the page hydrates,
 * pressing enter submits it the browser's own way, and a form with no method
 * does that as a GET — which would put whatever was typed, a password
 * included, into the address bar, the history and the server log.
 */
export function useFormAction<State>(
  action: (previous: State, formData: FormData) => Promise<State>,
  initialState: State,
): {
  state: State;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  reset: () => void;
} {
  const [state, setState] = useState<State>(initialState);
  const [pending, startTransition] = useTransition();

  // Read through a ref so the callback does not change on every state update.
  const stateRef = useRef(state);
  stateRef.current = state;

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      startTransition(async () => {
        const next = await action(stateRef.current, formData);
        // A redirecting action never gets here.
        if (next !== undefined) setState(next);
      });
    },
    [action],
  );

  const reset = useCallback(() => setState(initialState), [initialState]);

  return { state, pending, onSubmit, reset };
}
