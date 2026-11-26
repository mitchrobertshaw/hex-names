import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MetaMaskPage } from "./MetaMaskPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MetaMaskPage />
  </StrictMode>,
);
