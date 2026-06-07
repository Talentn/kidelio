import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ListTodo, MessageCircle, Cpu } from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card } from "../../components/admin/ui";

type QueuesStatus = {
  checked_at: string;
  puma: {
    max_threads: number;
    web_concurrency: number;
    total_http_threads: number;
    solid_queue_in_puma: boolean;
  };
  solid_queue: {
    available: boolean;
    detail?: string;
    counts?: {
      ready: number;
      scheduled: number;
      running: number;
      blocked: number;
      failed: number;
      unfinished_jobs: number;
    };
    processes?: {
      name: string;
      kind: string;
      pid: number;
      hostname: string;
      last_heartbeat_at: string;
    }[];
    recent_failures?: {
      job_id: number;
      class_name?: string;
      queue_name?: string;
      error?: string;
      failed_at: string;
    }[];
    paused_queues?: string[];
  };
  chat_queue: {
    available: boolean;
    detail?: string;
    waiting_count?: number;
    rooms?: {
      id: string;
      user_name: string;
      user_email?: string;
      status: string;
      created_at: string;
    }[];
  };
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR");
}

function CountCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ?? "border-slate-200 bg-slate-50"}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export function QueuesStatus() {
  const [data, setData] = useState<QueuesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    apiAdmin<QueuesStatus>("/queues-status")
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Impossible de charger les files");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const sq = data?.solid_queue;
  const cq = data?.chat_queue;

  return (
    <AdminPage
      title="Files d'attente"
      subtitle="Jobs, threads Puma et chat support — accès restreint"
      actions={
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      }
    >
      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50 text-red-800 text-sm font-medium">{error}</Card>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Dernière vérification : {formatTime(data.checked_at)}
          </p>

          {/* Puma / threads */}
          <Card className="p-5">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-brand-500" />
              Pool de threads Puma
            </h2>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Threads par worker</dt>
                <dd className="text-xl font-bold text-slate-900">{data.puma.max_threads}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Workers</dt>
                <dd className="text-xl font-bold text-slate-900">{data.puma.web_concurrency}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Total HTTP concurrent</dt>
                <dd className="text-xl font-bold text-slate-900">{data.puma.total_http_threads}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Solid Queue dans Puma</dt>
                <dd className="text-xl font-bold text-slate-900">
                  {data.puma.solid_queue_in_puma ? "Oui" : "Non"}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Solid Queue */}
          <Card className="p-5">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ListTodo size={18} className="text-brand-500" />
              Jobs en arrière-plan (Solid Queue)
            </h2>
            {!sq?.available ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                {sq?.detail ?? "Indisponible"}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                  <CountCard label="Prêts" value={sq.counts!.ready} />
                  <CountCard label="Planifiés" value={sq.counts!.scheduled} />
                  <CountCard label="En cours" value={sq.counts!.running} accent="border-sky-200 bg-sky-50" />
                  <CountCard label="Bloqués" value={sq.counts!.blocked} accent="border-amber-200 bg-amber-50" />
                  <CountCard label="Échoués" value={sq.counts!.failed} accent="border-red-200 bg-red-50" />
                  <CountCard label="Non terminés" value={sq.counts!.unfinished_jobs} />
                </div>

                {sq.paused_queues && sq.paused_queues.length > 0 && (
                  <p className="text-sm text-amber-800 mb-4">
                    Files en pause : {sq.paused_queues.join(", ")}
                  </p>
                )}

                {sq.processes && sq.processes.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-slate-700 mb-2">Workers actifs</h3>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="pb-2 font-semibold">Nom</th>
                            <th className="pb-2 font-semibold">Type</th>
                            <th className="pb-2 font-semibold">PID</th>
                            <th className="pb-2 font-semibold">Dernier heartbeat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sq.processes.map((p) => (
                            <tr key={`${p.name}-${p.pid}`} className="border-b border-slate-50">
                              <td className="py-2 font-medium">{p.name}</td>
                              <td className="py-2">{p.kind}</td>
                              <td className="py-2">{p.pid}</td>
                              <td className="py-2 text-slate-500">{formatTime(p.last_heartbeat_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {sq.recent_failures && sq.recent_failures.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-red-700 mb-2">Échecs récents</h3>
                    <div className="space-y-2">
                      {sq.recent_failures.map((f) => (
                        <div key={f.job_id} className="text-xs bg-red-50 border border-red-100 rounded-xl p-3">
                          <p className="font-bold text-red-800">
                            {f.class_name} <span className="text-red-600 font-normal">({f.queue_name})</span>
                          </p>
                          <p className="text-red-700 mt-1 whitespace-pre-wrap break-words">{f.error}</p>
                          <p className="text-red-500 mt-1">{formatTime(f.failed_at)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Card>

          {/* Chat queue */}
          <Card className="p-5">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageCircle size={18} className="text-brand-500" />
              File d'attente chat support
            </h2>
            {!cq?.available ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                {cq?.detail ?? "Go service indisponible"}
              </p>
            ) : cq.waiting_count === 0 ? (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                Aucun client en attente
              </p>
            ) : (
              <div className="overflow-x-auto">
                <p className="text-sm font-semibold text-slate-600 mb-3">
                  {cq.waiting_count} client{cq.waiting_count! > 1 ? "s" : ""} en attente
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="pb-2 font-semibold">Client</th>
                      <th className="pb-2 font-semibold">Email</th>
                      <th className="pb-2 font-semibold">Depuis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cq.rooms?.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2 font-medium">{r.user_name}</td>
                        <td className="py-2 text-slate-500">{r.user_email || "—"}</td>
                        <td className="py-2 text-slate-500">{formatTime(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </AdminPage>
  );
}
