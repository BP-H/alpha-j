// src/main.tsx
import "./bootstrap";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { setSuperUserKey } from "./lib/superUser";
import bus from "./lib/bus";

const initialSuperKey = (() => {
  try {
    return localStorage.getItem("superUserKey") || "";
  } catch {
    return "";
  }
})();
setSuperUserKey(initialSuperKey);

const root = document.getElementById("root");
if (!root) {
  const message = "Missing #root element – app cannot mount.";
  bus.emit?.("toast", { message });
  console.error(message);
  const fallback = document.createElement("p");
  fallback.textContent = "An unexpected error occurred while loading the app.";
  document.body.appendChild(fallback);
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

