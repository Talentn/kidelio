import { useCallback, useEffect, useState } from "react";
import {
  Server,
  Database,
  Zap,
  HardDrive,
  Layers,
  ListTodo,
  Package,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card } from "../../components/admin/ui";

type ServiceStatus = "ok" | "degraded" | "down";
type OverallStatus = "healthy" | "degraded" | "down";

type Service = {
  id: string;
  name: string;
  status: ServiceStatus;
  latency_ms?: number;
  detail?: string;
};

type SystemStatus = {
  checked_at: string;
  overall: OverallStatus;
  services: Service[];
  environment: {
    rails_env: string;
    site_url?: string;
    go_service_url?: string;
    solid_queue_in_puma: boolean;
    google_auth_configured: boolean;
    meta_pixel_configured: boolean;
  };
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  rails: <Server size={20} />,
  database: <Database size={20} />,
  go_service: <Zap size={20} />,
  cache: <Layers size={20} />,
  storage: <HardDrive size={20} />,
  queue: <ListTodo size={20} />,
  store_api: <Package size={20} />,
};

const STATUS_META: Record<
  ServiceStatus | OverallStatus,
  { label: string; icon: React.ReactNode; card: string; badge: string }
> = {
  ok: {
    label: "OK",
    icon: <CheckCircle2 size={18} />,
    card: "border-emerald-200 bg-emerald-50/50",
    badge: "bg-emerald-100 text-emerald-800",
  },
  healthy: {
    label: "Tout fonctionne",
    icon: <CheckCircle2 size={18} />,
    card: "border-emerald-200 bg-emerald-50/50",
    badge: "bg-emerald-100 text-emerald-800",
  },
  degraded: {
    label: "Dégradé",
    icon: <AlertTriangle size={18} />,
    card: "border-amber-200 bg-amber-50/50",
    badge: "bg-amber-100 text-amber-800",
  },
  down: {
    label: "Hors ligne",
    icon: <XCircle size={18} />,
    card: "border-red-200 bg-red-50/50",
    badge: "bg-red-100 text-red-800",
  },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR");
}

export function SystemStatus() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    apiAdmin<SystemStatus>("/system-status")
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Impossible de charger le statut");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const overall = data ? STATUS_META[data.overall] : null;

  return (
    <AdminPage
      title="État des services"
      subtitle="Surveillance infrastructure — accès restreint"
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
        <Card className="p-4 mb-6 border-red-200 bg-red-50 text-red-800 text-sm font-medium">
          {error}
        </Card>
      )}

      {loading && !data ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <Card className={`p-5 border-2 ${overall?.card ?? ""}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={overall?.badge}>{overall?.icon}</span>
                <div>
                  <p className="text-sm text-slate-500 font-semibold">État global</p>
                  <p className="text-xl font-bold text-slate-900">{overall?.label}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Dernière vérification : {formatTime(data.checked_at)}
              </p>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.services.map((svc) => {
              const meta = STATUS_META[svc.status];
              return (
                <Card key={svc.id} className={`p-5 border ${meta.card}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-700">
                      <span className="text-brand-600">{SERVICE_ICONS[svc.id]}</span>
                      <h3 className="font-bold text-sm">{svc.name}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${meta.badge}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                  {svc.latency_ms != null && (
                    <p className="text-sm text-slate-600 mt-3">
                      Latence : <span className="font-semibold">{svc.latency_ms} ms</span>
                    </p>
                  )}
                  {svc.detail && (
                    <p className="text-xs text-slate-500 mt-1 break-all">{svc.detail}</p>
                  )}
                </Card>
              );
            })}
          </div>

          <Card className="p-5">
            <h2 className="font-bold text-slate-900 mb-4">Environnement</h2>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Rails env</dt>
                <dd className="font-semibold text-slate-800">{data.environment.rails_env}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Site URL</dt>
                <dd className="font-semibold text-slate-800 break-all">
                  {data.environment.site_url ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Go service</dt>
                <dd className="font-semibold text-slate-800 break-all">
                  {data.environment.go_service_url ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Solid Queue in Puma</dt>
                <dd className="font-semibold text-slate-800">
                  {data.environment.solid_queue_in_puma ? "Oui" : "Non"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Google OAuth</dt>
                <dd className="font-semibold text-slate-800">
                  {data.environment.google_auth_configured ? "Configuré" : "Non configuré"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Meta Pixel</dt>
                <dd className="font-semibold text-slate-800">
                  {data.environment.meta_pixel_configured ? "Configuré" : "Non configuré"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      ) : null}
    </AdminPage>
  );
}
