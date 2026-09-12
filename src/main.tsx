import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./styles.css";
import "./responsive.css";
import App from "./App";

// Keep long-lived phone tabs on the current UI. The generated worker already
// replaces itself immediately; this listener reloads the open page when that
// replacement activates, and checks again when the interviewer returns to it.
registerSW({
  immediate: true,
  onRegisteredSW: (_url, registration) => {
    const checkForUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void registration?.update();
      }
    };
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.setInterval(checkForUpdate, 30 * 60 * 1000);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
