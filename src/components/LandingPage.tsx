import { useEffect } from "react";

function openEditor() {
  localStorage.setItem("easyschematic-skip-landing", "1");
  window.location.href = "/";
}

/**
 * Minimal FACE-branded landing: brand wordmark + a single call to action.
 * Dark-first (FACE #1A1A1A), red accent (#CC0000) — no marketing copy.
 */
export default function LandingPage() {
  // The app shell sets overflow:hidden; let this standalone page size itself.
  useEffect(() => {
    const root = document.getElementById("root");
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    if (root) root.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      if (root) root.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[#1A1A1A]"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <h1
        className="text-5xl md:text-6xl font-extrabold tracking-tight"
        style={{ letterSpacing: "0.01em" }}
      >
        <span style={{ color: "#CC0000" }}>FACE</span>
        <span className="text-white">Schematic</span>
      </h1>

      <div className="mt-6 mb-10 h-0.5 w-14 rounded-full bg-[#CC0000]" />

      <button
        onClick={openEditor}
        className="font-semibold px-9 py-3 rounded-md text-base text-white bg-[#CC0000] hover:bg-[#a30000] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1A]"
      >
        Editor öffnen
      </button>

      <div className="absolute bottom-6 text-[11px] uppercase tracking-[0.25em] text-[#666666]">
        FACE GmbH
      </div>
    </div>
  );
}
