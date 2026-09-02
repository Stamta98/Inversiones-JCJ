"use client";

import { useEffect, useState } from "react";

import { Alert, Button, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * The event Chrome fires when the app can be installed. It is not in the DOM
 * typings because it is not standardised, so it is described here.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "prompt" | "ios" | "installed" | "manual";

/** Safari never fires the install event; there the user does it by hand. */
function isIosSafari(): boolean {
  const agent = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(agent) ||
    // An iPad on iPadOS reports itself as a Mac with a touch screen.
    (agent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIos && !/CriOS|FxiOS|EdgiOS/.test(agent);
}

export function InstallAppCard() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("manual");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Already running from the home screen: there is nothing left to install.
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setPlatform("installed");
      return;
    }
    if (isIosSafari()) {
      setPlatform("ios");
      return;
    }

    const onPrompt = (incoming: Event) => {
      // Holding the event is what lets the button open the install dialog
      // later; the browser only offers it once, at a moment of its choosing.
      incoming.preventDefault();
      setEvent(incoming as InstallPromptEvent);
      setPlatform("prompt");
    };
    const onInstalled = () => {
      setDone(true);
      setEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (done || platform === "installed") {
    return (
      <CardBody>
        <Alert tone="positive" icon="check">
          {es.install.alreadyInstalled}
        </Alert>
      </CardBody>
    );
  }

  if (platform === "ios") {
    return (
      <CardBody className="space-y-3 text-sm text-ink">
        <p className="text-ink-muted">{es.install.iosIntro}</p>
        <ol className="list-decimal space-y-1 pl-5 text-ink-muted">
          {es.install.iosSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </CardBody>
    );
  }

  if (platform === "prompt" && event) {
    return (
      <CardBody className="space-y-3">
        <p className="text-sm text-ink-muted">{es.install.androidIntro}</p>
        <Button
          type="button"
          icon="plus"
          onClick={() => {
            void event.prompt().then(() => setEvent(null));
          }}
        >
          {es.install.action}
        </Button>
      </CardBody>
    );
  }

  return (
    <CardBody className="space-y-3 text-sm">
      <p className="text-ink-muted">{es.install.manualIntro}</p>
      <ol className="list-decimal space-y-1 pl-5 text-ink-muted">
        {es.install.androidSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </CardBody>
  );
}
