import { useEffect, useState } from "react";
import { api } from "../api/client";

type Log = {
  id: number;
  action: string;
  entity_type: string;
  entity_name?: string;
  changes: Record<string, unknown>;
  created_at: string;
  user?: { name: string; email: string; role: string };
};

export function ActivityLogs() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    api<{ logs: Log[] }>("/admin/activity-logs?limit=100").then((d) => setLogs(d.logs));
  }, []);

  return (
    <div>
      <h1>Journal d'activité</h1>
      <p className="hint">Actions enregistrées des administrateurs et employés</p>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Entité</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.created_at).toLocaleString("fr-FR")}</td>
              <td>
                {log.user?.name || "—"}
                <br />
                <small>{log.user?.email}</small>
              </td>
              <td><code>{log.action}</code></td>
              <td>
                {log.entity_type}
                {log.entity_name && ` — ${log.entity_name}`}
              </td>
              <td>
                <pre className="changes-pre">
                  {JSON.stringify(log.changes, null, 0).slice(0, 120)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
