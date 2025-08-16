// src/main.tsx
import "./bootstrap";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";

const root = document.getElementById("root");
if (!root) {
  console.error("Missing #root element – app cannot mount.");
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

