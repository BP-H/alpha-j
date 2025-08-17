import { useEffect, useState } from "react";
import Toast from "./Toast";
import { on } from "../lib/bus";

export default function ToastContainer() {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const off = on("notify", (m: string) => setMsg(m));
    return off;
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  return <Toast message={msg} onClose={() => setMsg("")} />;
}
