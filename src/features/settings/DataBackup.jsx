import { buildBackup, applyBackup } from "../../lib/backup";
import { card, hdr, btn } from "../../styles";

// Format a Date as YYYY-MM-DD for the backup filename.
function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Data backup card: download all app data as a JSON file, or restore from one.
// Restoring overwrites current data, so it confirms first and reloads after so
// React state re-hydrates from the freshly-written localStorage.
export default function DataBackup() {
  const exportData = () => {
    const json = JSON.stringify(buildBackup(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slackers-brew-backup-${dateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        window.alert("Couldn't read that file — it isn't valid JSON.");
        return;
      }
      if (!window.confirm("Importing will replace ALL current data (inventory, recipes, orders, settings) with the contents of this file. Continue?")) {
        return;
      }
      try {
        applyBackup(parsed);
      } catch (err) {
        window.alert(err.message || "That backup file couldn't be imported.");
        return;
      }
      window.alert("Import complete. Reloading to apply your data.");
      window.location.reload();
    };
    reader.readAsText(file);
  };

  return (
    <div style={card}>
      <div style={hdr}>💾 Data Backup</div>
      <div style={{ padding: 16 }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569" }}>
          Your data lives only in this browser. Export a backup regularly so you don't lose
          your inventory and recipes, and to move data to another device.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" style={btn} onClick={exportData}>Export backup</button>
          <label style={{ ...btn, cursor: "pointer" }}>
            Import backup
            <input type="file" accept="application/json,.json" onChange={importData} style={{ display: "none" }} />
          </label>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11, color: "#94a3b8" }}>
          Importing replaces all current data. Export first if you want to keep what you have.
        </p>
      </div>
    </div>
  );
}
