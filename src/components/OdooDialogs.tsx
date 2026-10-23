import { useEffect } from "react";
import { create } from "zustand";
import { FaceApiError, useFaceSession } from "../faceBackend";
import { LockedError, saveOdooDrawing, startOdooPresence, useOdooPresence } from "../faceDrawings";
import { useSchematicStore } from "../store";
import { t } from "../i18n";
import FaceLoginDialog from "./FaceLoginDialog";
import OdooSaveDialog from "./OdooSaveDialog";
import OdooOpenDialog from "./OdooOpenDialog";

type OdooDialog = "save" | "open" | null;

/** Which Odoo dialog is open — asked for from the menu, from Ctrl+S, later from Claude. */
export const useOdooDialogs = create<{ open: OdooDialog }>(() => ({ open: null }));
export const showOdooDialog = (open: OdooDialog) => useOdooDialogs.setState({ open });

/**
 * Ctrl+S for content that is an Odoo drawing: back to its project. A reader — someone else
 * edits — gets "Save to Odoo as…" instead. Returns false when the content is no Odoo drawing,
 * so the caller saves the usual way.
 */
export async function saveToOdooIfLinked(): Promise<boolean> {
  const store = useSchematicStore.getState();
  if (!store.odooDrawing) return false;
  if (!useFaceSession.getState().user || useOdooPresence.getState().role === "viewer") {
    showOdooDialog("save");
    return true;
  }
  try {
    await saveOdooDrawing();
    store.addToast(t("Saved to Odoo"), "success", 1500);
  } catch (err) {
    if (err instanceof LockedError) showOdooDialog("save");
    else if (err instanceof FaceApiError && err.status === 401) useFaceSession.setState({ user: null });
    store.addToast(err instanceof Error ? err.message : t("Saving to Odoo failed."), "error");
  }
  return true;
}

/** Mounted once (FACE build): the Odoo dialogs, behind the Odoo sign-in when needed. */
export default function OdooDialogs() {
  const open = useOdooDialogs((s) => s.open);
  const user = useFaceSession((s) => s.user);
  const close = () => showOdooDialog(null);

  useEffect(() => {
    startOdooPresence();
  }, []);

  if (!open) return null;
  // A successful sign-in also "closes" the login dialog — then carry on to the dialog asked for.
  if (!user) return <FaceLoginDialog open onClose={() => !useFaceSession.getState().user && close()} />;
  return open === "open" ? <OdooOpenDialog onClose={close} /> : <OdooSaveDialog onClose={close} />;
}
