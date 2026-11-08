import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/geist";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
