import React, { useMemo } from "react";

export default function UsageMonitor({
  students = 997,
  savesPerStudentPerDay = 3,
  teachers = 1,
  colors = { primary: "#800020", accent: "#FFD700" },
  show = true
}) {
  if (!show) return null;

  const FREE_READS = 50000;
  const FREE_WRITES = 20000;

  const { dailyReads, dailyWrites, readsPct, writesPct, riskLevel, notes } = useMemo(() => {
    const writesPerSave = 2; // student doc + teacher copy
    const writes = students * savesPerStudentPerDay * writesPerSave;

    const studentReads = students * (1 + savesPerStudentPerDay);
    const teacherInitial = students;
    const teacherWatcher = students * savesPerStudentPerDay;
    const reads = studentReads + teacherInitial + teacherWatcher;

    const readsPct = Math.min(100, Math.round((reads / FREE_READS) * 100));
    const writesPct = Math.min(100, Math.round((writes / FREE_WRITES) * 100));

    let risk = "low";
    if (readsPct >= 80 || writesPct >= 80) risk = "elevated";
    if (readsPct >= 100 || writesPct >= 100) risk = "exceeded";

    const notes = [];
    if (risk === "elevated") notes.push("Approaching free daily limits. Consider reducing autosaves or enabling Blaze.");
    if (risk === "exceeded") notes.push("Exceeded free daily limits. Some operations may fail on Spark.");

    return { dailyReads: reads, dailyWrites: writes, readsPct, writesPct, riskLevel: risk, notes };
  }, [students, savesPerStudentPerDay, teachers]);

  const Bar = (pct, label) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{label}: {pct}%</div>
      <div style={{ height: 10, background: "#eee", borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: pct >= 100 ? "#DB4437" : pct >= 80 ? "#FBBC05" : colors.primary,
          transition: "width 0.3s"
        }}/>
      </div>
    </div>
  );

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: 16,
      margin: "20px auto",
      maxWidth: 700,
      boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
      border: `1px solid ${colors.accent}33`
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>📈 Usage Monitor (Daily Estimate)</h3>
        <span style={{
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          background: riskLevel === "exceeded" ? "#DB4437" : riskLevel === "elevated" ? "#FBBC05" : colors.primary
        }}>
          {riskLevel.toUpperCase()}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>
        Students: <b>{students}</b> • Saves/Student/Day: <b>{savesPerStudentPerDay}</b> • Teachers: <b>{teachers}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Reads</div>
          {Bar(readsPct, "vs 50,000 free/day")}
          <div style={{ fontSize: 12 }}>Estimated reads/day: <b>{dailyReads.toLocaleString()}</b></div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Writes</div>
          {Bar(writesPct, "vs 20,000 free/day")}
          <div style={{ fontSize: 12 }}>Estimated writes/day: <b>{dailyWrites.toLocaleString()}</b></div>
        </div>
      </div>

      {notes.length > 0 && (
        <ul style={{ marginTop: 12, color: "#B00020", fontSize: 13 }}>
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Tip: Lower saves per student or limit concurrent teacher dashboards to reduce reads.
      </div>
    </div>
  );
}
