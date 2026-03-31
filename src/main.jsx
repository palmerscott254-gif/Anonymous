import React from "react";
import { createRoot } from "react-dom/client";
import GhostChat from "../GhostChat.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GhostChat />
  </React.StrictMode>
);
