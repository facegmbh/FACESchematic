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
      <img
        src="/face-logo.png"
        alt="FACE GmbH"
        className="w-[260px] max-w-[78vw] h-auto"
      />
      <div className="mt-4 text-sm md:text-base uppercase tracking-[0.4em] text-[#d4d4d4] pl-[0.4em]">
        Schematic
      </div>

      <div className="mt-7 mb-10 h-0.5 w-14 rounded-full bg-[#CC0000]" />

      <button
        onClick={openEditor}
        className="font-semibold px-9 py-3 rounded-md text-base text-white bg-[#CC0000] hover:bg-[#a30000] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1A]"
      >
        Editor öffnen
      </button>
    </div>
  );
}
