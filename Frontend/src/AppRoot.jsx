import React, { useEffect, useRef, useState } from "react";
import App from "./App";
import { registerServiceWorker, applyUpdate } from "./registerServiceWorker";
import { UpdateToast } from "./pwa/UpdateToast";
import { ErrorBoundary } from "./pwa/ErrorBoundary";
import { hideSplash } from "./pwa/splash";

export default function AppRoot() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const registrationRef = useRef(null);

  useEffect(() => {
    // First paint has happened by the time this effect runs — swap out
    // the inline splash for the real app the same way a native launch
    // screen hands off to the first rendered frame.
    hideSplash();

    registerServiceWorker((registration) => {
      registrationRef.current = registration;
      setUpdateReady(true);
      setDismissed(false);
    });
  }, []);

  return (
    <>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <UpdateToast
        visible={updateReady && !dismissed}
        onUpdate={() => applyUpdate(registrationRef.current)}
        onDismiss={() => setDismissed(true)}
      />
    </>
  );
}
