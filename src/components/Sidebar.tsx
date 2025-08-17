import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";
import bus from "../lib/bus";
import { useTheme } from "../lib/useTheme";
import {
  getKey as getSecureKey,
  setKey as setSecureKey,
  removeKey as removeSecureKey,
} from "../lib/secureStore";

function useLocal<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return init;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

function useSecure(key: string, legacy?: string) {
  const [v, setV] = useState(() => {
    if (typeof window === "undefined") return "";
    const current = getSecureKey(key);
    if (current) return current;
    return legacy ? getSecureKey(legacy) : "";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !legacy) return;
    const legacyVal = getSecureKey(legacy);
    if (legacyVal) {
      setSecureKey(key, legacyVal);
      removeSecureKey(legacy);
      setV(legacyVal);
    }
  }, [key, legacy]);

  const update = (val: string) => {
    setV(val);
    if (typeof window === "undefined") return;
    if (val) setSecureKey(key, val);
    else removeSecureKey(key);
    if (legacy) removeSecureKey(legacy);
  };
  return [v, update] as const;
}

export default function Sidebar() {
  const [open, setOpen] = useLocal("sn.sidebar.open", false);

  useEffect(() => {
    const a = bus.on("sidebar:toggle", () => setOpen((v) => !v));
    const b = bus.on("sidebar:open", () => setOpen(true));
    const c = bus.on("sidebar:close", () => setOpen(false));
    return () => {
      a?.();
      b?.();
      c?.();
    };
  }, [setOpen]);

  // Profile info and settings...
  const [name, setName] = useLocal("sn.profile.name", "Your Name");
  const [handle, setHandle] = useLocal("sn.profile.handle", "@you");
  const [bio, setBio] = useLocal(
    "sn.profile.bio",
    "I bend worlds with orbs and postcards."
  );
  const [avatar, setAvatar] = useLocal("sn.profile.avatar", "/avatar.jpg");

  // Trigger the AvatarPortal splash whenever the avatar changes
  const avatarChanged = useRef(false);
  useEffect(() => {
    if (avatarChanged.current) {
      bus.emit("avatar-portal:open");
    } else {
      avatarChanged.current = true;
    }
  }, [avatar]);

  const [theme, setTheme] = useTheme();
  const [accent, setAccent] = useLocal("sn.accent", "#7c83ff");
  const [worldMode, setWorldMode] = useLocal<"orbs" | "matrix">(
    "sn.world.mode",
    "orbs"
  );
  const [orbCount, setOrbCount] = useLocal("sn.world.count", 64);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  const [openaiKey, setOpenaiKey] = useSecure("openai", "sn2177.apiKey");
  const [anthropicKey, setAnthropicKey] = useSecure("anthropic");
  const [perplexityKey, setPerplexityKey] = useSecure("perplexity");
  const [unsplashKey, setUnsplashKey] = useSecure("unsplash");
  const [pexelsKey, setPexelsKey] = useSecure("pexels");
  const [openaiDraft, setOpenaiDraft] = useState(openaiKey);
  const [anthropicDraft, setAnthropicDraft] = useState(anthropicKey);
  const [perplexityDraft, setPerplexityDraft] = useState(perplexityKey);
  const [unsplashDraft, setUnsplashDraft] = useState(unsplashKey);
  const [pexelsDraft, setPexelsDraft] = useState(pexelsKey);

  useEffect(() => {
    setOpenaiDraft(openaiKey);
    setAnthropicDraft(anthropicKey);
    setPerplexityDraft(perplexityKey);
    setUnsplashDraft(unsplashKey);
    setPexelsDraft(pexelsKey);
  }, [openaiKey, anthropicKey, perplexityKey, unsplashKey, pexelsKey]);
  const [openaiModel, setOpenaiModel] = useLocal(
    "sn.model.openai",
    "gpt-4o-mini",
  );
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const toggleShow = (k: string) =>
    setShowKeys((s) => ({ ...s, [k]: !s[k] }));

  const keyFields = [
    {
      id: "openai",
      label: "OpenAI (voice & text assistants)",
      value: openaiDraft,
      onChange: (v: string) => {
        setOpenaiDraft(v);
        setOpenaiKey(v);
      },
      onSave: () => setOpenaiKey(openaiDraft),
      onRemove: () => {
        setOpenaiDraft("");
        setOpenaiKey("");
      },
    },
    {
      id: "anthropic",
      label: "Anthropic",
      value: anthropicDraft,
      onChange: setAnthropicDraft,
      onSave: () => setAnthropicKey(anthropicDraft),
      onRemove: () => {
        setAnthropicDraft("");
        setAnthropicKey("");
      },
    },
    {
      id: "perplexity",
      label: "Perplexity",
      value: perplexityDraft,
      onChange: setPerplexityDraft,
      onSave: () => setPerplexityKey(perplexityDraft),
      onRemove: () => {
        setPerplexityDraft("");
        setPerplexityKey("");
      },
    },
    {
      id: "unsplash",
      label: "Unsplash",
      value: unsplashDraft,
      onChange: setUnsplashDraft,
      onSave: () => setUnsplashKey(unsplashDraft),
      onRemove: () => {
        setUnsplashDraft("");
        setUnsplashKey("");
      },
    },
    {
      id: "pexels",
      label: "Pexels",
      value: pexelsDraft,
      onChange: setPexelsDraft,
      onSave: () => setPexelsKey(pexelsDraft),
      onRemove: () => {
        setPexelsDraft("");
        setPexelsKey("");
      },
    },
  ];

  const pages = [
    { label: "Home", path: "/", icon: "🏠" },
    { label: "Feed", path: "/feed", icon: "📰" },
    { label: "Chat", path: "/chat", icon: "💬" },
    { label: "Messages", path: "/messages", icon: "✉️" },
    { label: "Voting", path: "/voting", icon: "🗳️" },
    { label: "Profile", path: "/profile", icon: "👤" },
    { label: "Settings", path: "/settings", icon: "⚙️" },
  ];

  // Accessibility: focus management & Escape-to-close
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevActive = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open && e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      prevActive.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => panelRef.current?.focus());
    } else {
      prevActive.current?.focus?.();
    }
  }, [open]);

  return (
    <>
      <div
        className={`sb-scrim ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-label="Close sidebar"
        aria-hidden={!open}
        role="presentation"
      />
      <aside className={`sb ${open ? "open" : ""}`} aria-hidden={!open}>
        <div
          ref={panelRef}
          className="sb-panel"
          role="dialog"
          aria-modal={open}
          aria-labelledby="sb-title"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="sb-head">
            <button
              className="sb-x"
              onClick={() => setOpen(false)}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
            <div className="sb-brand">
              <span className="sb-orb" />
              <span id="sb-title" className="sb-logo">
                superNova
              </span>
            </div>
          </div>

          {/* Navigation */}
          <section className="card">
            <header>Navigation</header>
            <nav className="sb-nav" aria-label="Navigation">
              <ul>
                {pages.map((p) => (
                  <li key={p.path}>
                    <NavLink
                      to={p.path}
                      end
                      className={({ isActive }) => (isActive ? "active" : "")}
                      onClick={() => setOpen(false)}
                      aria-label={p.label}
                    >
                      <span aria-hidden>{p.icon}</span>
                      <span>{p.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </section>

          <section className="card">
            <header>Premium features</header>
            <nav className="sb-nav sb-nav-premium" aria-label="Premium features">
              <ul>
                <li>
                  <NavLink
                    to="/music"
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={() => setOpen(false)}
                    aria-label="Music"
                  >
                    <span aria-hidden>🎵</span>
                    <span>Music</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/agents"
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={() => setOpen(false)}
                    aria-label="Agents"
                  >
                    <span aria-hidden>🤖</span>
                    <span>Agents</span>
                  </NavLink>
                </li>
              </ul>
            </nav>
          </section>

          {/* Profile card */}
          <section className="card profile">
            {/* ... profile avatar, name, handle inputs ... */}
          </section>

          {/* Appearance settings */}
          <section className="card">
            <header>Appearance</header>
            <div className="grid two">
              <div>
                <label className="label">Theme</label>
                <select
                  className="input"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div>
                <label className="label">Accent</label>
                <div className="swatches">
                  {["#7c83ff", "#ff74de", "#00ffa2", "#9efcff", "#ffd166"].map(
                    (c) => (
                      <button
                        key={c}
                        className={`sw ${c === accent ? "on" : ""}`}
                        style={{ background: c }}
                        onClick={() => setAccent(c)}
                        aria-label={c}
                        type="button"
                      />
                    )
                  )}
                  <input
                    className="input"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid two">
              <div>
                <label className="label">Background</label>
                <select
                  className="input"
                  value={worldMode}
                  onChange={(e) => setWorldMode(e.target.value as any)}
                >
                  <option value="orbs">Orb Mesh</option>
                  <option value="matrix">Matrix Drift</option>
                </select>
              </div>
              <div>
                <label className="label">Orb density</label>
                <input
                  className="input"
                  type="range"
                  min={16}
                  max={160}
                  step={4}
                  value={orbCount}
                  onChange={(e) => setOrbCount(parseInt(e.target.value, 10))}
                />
              </div>
            </div>
            <p className="hint">Changes apply instantly and persist on this device.</p>
          </section>

          <section className="card">
            <header>API Keys</header>
            <div className="keys">
              {keyFields.map(
                ({ id, label, value, onChange, onSave, onRemove }) => (
                  <div key={id} className="key-field">
                    <label className="label" htmlFor={`key-${id}`}>
                      {label}
                    </label>
                    <div className="key-input">
                      <input
                        id={`key-${id}`}
                        className="input"
                        type={showKeys[id] ? "text" : "password"}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                      />
                      <button
                        className="key-toggle"
                        onClick={() => toggleShow(id)}
                        type="button"
                      >
                        {showKeys[id] ? "Hide" : "Show"}
                      </button>
                      <button className="key-toggle" onClick={onSave} type="button">
                        Save
                      </button>
                      <button className="key-toggle" onClick={onRemove} type="button">
                        Remove
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
            <p className="hint">Stored only in your browser for local use.</p>
          </section>

          <section className="card">
            <header>AI Model</header>
            <div className="key-field">
              <label className="label" htmlFor="model-openai">
                OpenAI model
              </label>
              <input
                id="model-openai"
                className="input"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
              />
            </div>
          </section>

          {/* Integrations, Privacy, Danger Zone sections ... */}

          <footer className="sb-foot">made with ✨</footer>
        </div>
      </aside>
    </>
  );
}
