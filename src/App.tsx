// src/App.tsx
import React from "react";
import Shell from "./components/Shell";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css"; // global reset/theme (includes your orb/chat/portal CSS)

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
