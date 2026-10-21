import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Activity, Ambulance, ArrowRight, ArrowUpRight, Bell, Check, CircleHelp, ClipboardList, Clock3, Cross, FileBarChart, Filter, Hospital as HospitalIcon, LayoutDashboard, LifeBuoy, LogOut, MapPin, Menu, Plus, RefreshCw, Search, Settings, ShieldCheck, Siren, Sparkles, Stethoscope, User as UserIcon, X, type LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapContainer, Marker, TileLayer, Tooltip as MapTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useLiveOperations } from "./hooks/use-live-operations";
import { demoSnapshot, useDemoData, createEmergency as createDemoEmergency, setEmergencyStatus as setDemoEmergencyStatus, assignAmbulance as assignDemoAmbulance, decideHospital as decideDemoHospital, updateResources as updateDemoResources, markNotificationRead as markDemoNotificationRead, addAudit as addDemoAudit } from "./lib/demo-store";
import type { Emergency, Role, User, Hospital, Ambulance as AmbulanceType, AuditEvent, Notification } from "./lib/types";
import { authService, getStoredUser, getStoredToken, trustedRole } from "./services/auth-service";
import { emergenciesService, type HospitalRecommendation } from "./services/emergencies-service";
import { analyticsService, type EvaluationMetrics, type TextClassificationResult } from "./services/analytics-service";
import { errorMessage } from "./lib/api-client";

const basePath = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Authentication Context (Supports Built-in JWT Auth & Optional Clerk)
// ---------------------------------------------------------------------------
interface AuthContextType {
  currentUser: User | null;
  role: Role | null;
  token: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  role: null,
  token: null,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {}
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [token, setToken] = useState<string | null>(getStoredToken());

  const syncAuth = () => {
    setUser(getStoredUser());
    setToken(getStoredToken());
  };

  useEffect(() => {
    window.addEventListener("seta_auth_change", syncAuth);
    return () => window.removeEventListener("seta_auth_change", syncAuth);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await authService.login(email, pass);
    setUser({
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
      trustedRole: res.user.trusted_role,
      status: res.user.status,
      hospital_id: res.user.hospital_id
    });
    setToken(res.access_token);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    try {
      const u = await authService.getMe();
      setUser(u);
    } catch {
      logout();
    }
  };

  const role = user ? trustedRole(user) : null;

  return (
    <AuthContext.Provider value={{ currentUser: user, role, token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Role-based Navigation Configuration
// ---------------------------------------------------------------------------
type NavigationItem = { label: string; to: string; icon: LucideIcon; roles: Role[] };
const navItems: NavigationItem[] = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, roles: ["dispatcher", "hospital", "paramedic", "admin"] },
  { label: "Emergencies", to: "/emergencies", icon: ClipboardList, roles: ["dispatcher", "admin"] },
  { label: "Triage queue", to: "/triage", icon: Activity, roles: ["dispatcher", "admin"] },
  { label: "Hospitals", to: "/hospitals", icon: HospitalIcon, roles: ["dispatcher", "hospital", "admin"] },
  { label: "Dispatch", to: "/dispatch", icon: Ambulance, roles: ["dispatcher", "paramedic", "admin"] },
  { label: "Hospital desk", to: "/hospital", icon: Cross, roles: ["hospital"] },
  { label: "Paramedic", to: "/paramedic", icon: LifeBuoy, roles: ["paramedic"] },
  { label: "Notifications", to: "/notifications", icon: Bell, roles: ["dispatcher", "hospital", "paramedic", "admin"] },
  { label: "Analytics", to: "/analytics", icon: FileBarChart, roles: ["dispatcher", "admin"] },
  { label: "Reports", to: "/reports", icon: ClipboardList, roles: ["dispatcher", "admin"] },
  { label: "Administration · users", to: "/admin/users", icon: Settings, roles: ["admin"] },
  { label: "Hospital directory", to: "/admin/hospitals", icon: HospitalIcon, roles: ["admin"] },
  { label: "Ambulance fleet", to: "/admin/ambulances", icon: Ambulance, roles: ["admin"] }
];

// ---------------------------------------------------------------------------
// Shared UI Components
// ---------------------------------------------------------------------------
function Brand({ invert = false }: { invert?: boolean }) {
  return (
    <Link to="/" className={`brand-lockup ${invert ? "text-white" : "text-[#1b2a3a]"} flex items-center gap-3 no-underline`} aria-label="SETA-HRC home">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#78c8b7] text-[#17283a]">
        <Cross size={23} strokeWidth={2.5} />
      </span>
      <span className="leading-tight">
        <strong className="block text-[15px] tracking-[.02em]">SETA-HRC</strong>
        <small className="text-[10px] opacity-65">Emergency coordination</small>
      </span>
    </Link>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  to,
  type = "button",
  disabled = false,
  className = ""
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet" | "outline" | "danger";
  to?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const style = `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50 ${
    variant === "primary"
      ? "bg-[#1d3548] text-white hover:bg-[#294a60]"
      : variant === "quiet"
      ? "bg-transparent text-[#3f5d6a] hover:bg-[#edf3f3]"
      : variant === "danger"
      ? "bg-[#b92736] text-white hover:bg-[#a21d2a]"
      : "border border-[#d9e3e7] bg-white text-[#284253] hover:bg-[#f4f7f8]"
  } ${className}`;

  const location = useLocation();
  const target = to && location.pathname.startsWith("/demo") && !to.startsWith("/demo") ? `/demo${to}` : to;
  return target ? (
    <Link to={target} className={style}>{children}</Link>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled} className={style}>{children}</button>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "mint" | "amber" | "red" | "blue" }) {
  const tones = {
    neutral: "bg-[#eef2f4] text-[#576a75] border-[#e2e8eb]",
    mint: "bg-[#e8f4f1] text-[#286e61] border-[#d0e8e1]",
    amber: "bg-[#fff5e4] text-[#895b13] border-[#f2e2bd]",
    red: "bg-[#fff0f0] text-[#b92736] border-[#f2c6ca]",
    blue: "bg-[#eaf1f6] text-[#395e78] border-[#d9e6ee]"
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function DemoTag() {
  return <span className="demo-ribbon inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-[.12em]">DEMO · SAMPLE DATA</span>;
}

function LiveTag() {
  return <span className="inline-flex items-center gap-1.5 rounded-md border border-[#c1e2d9] bg-[#edf8f5] px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-[#2c6e62]"><span className="h-2 w-2 rounded-full bg-[#279a83] animate-pulse"/> LIVE DATABASE</span>;
}

function PageTitle({ title, subtitle, action, demo = false }: { title: string; subtitle: string; action?: ReactNode; demo?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h1 className="m-0 text-[26px] font-semibold tracking-[-.035em] text-[#1b2a3a]">{title}</h1>
          {demo ? <DemoTag /> : <LiveTag />}
        </div>
        <p className="m-0 max-w-2xl text-sm text-[#73828b]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Metric({ label, value, delta, icon: Icon, tone = "mint" }: { label: string; value: string; delta: string; icon: typeof Activity; tone?: "mint" | "amber" | "red" }) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <span className="eyebrow">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          tone === "red" ? "bg-[#fff0f0] text-[#b92736]" : tone === "amber" ? "bg-[#fff5e4] text-[#9a6a20]" : "bg-[#e9f4f1] text-[#3c8d7d]"
        }`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <strong className="font-mono text-[28px] font-semibold tracking-[-.04em]">{value}</strong>
        <span className="text-[11px] text-[#73828b]">{delta}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Critical" ? "red" : status === "High" ? "amber" : status === "Available" || status === "Arrived" || status === "Closed" || status === "Accepted" ? "mint" : status === "Dispatched" || status === "En route" || status === "Transporting" ? "blue" : status === "Rejected" ? "red" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#dbe4e7] bg-[#fafcfc] px-5 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#edf3f3] text-[#58737d]">
        <CircleHelp size={18} />
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mb-0 mt-1 text-xs text-[#829099]">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell & Layout
// ---------------------------------------------------------------------------
function AppFrame({ children, role, demo = false, title = "Operations workspace" }: { children: ReactNode; role: Role; demo?: boolean; title?: string }) {
  const location = useLocation();
  const nav = useNavigate();
  const { logout, currentUser } = useAuth();
  const [menu, setMenu] = useState(false);
  const demoData = useDemoData();

  const items = navItems.filter((n) => n.roles.includes(role));

  const navMarkup = (mobile = false) => (
    <nav className={mobile ? "mobile-nav fixed bottom-0 left-0 z-40 w-full justify-around border-t border-[#dce4e8] bg-white px-1 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_30px_#17334a0b]" : "space-y-1"}>
      {items.slice(0, mobile ? 5 : items.length).map((item) => {
        const Icon = item.icon;
        const target = demo ? `/demo${item.to}` : item.to;
        const active = location.pathname === target || location.pathname.startsWith(`${target}/`);
        return (
          <Link
            key={item.to}
            to={target}
            onClick={() => setMenu(false)}
            className={`${mobile ? "flex min-w-0 flex-col items-center gap-1 px-1 py-1 text-[9px]" : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]"} ${
              active ? "bg-[#294658] text-white" : "text-[#c1d0d7] hover:bg-[#223c50] hover:text-white"
            }`}
          >
            <Icon size={18} />
            {mobile ? <span className="max-w-[64px] truncate">{item.label.split(" ")[0]}</span> : <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell flex bg-[#f4f7f8]">
      <aside className="desktop-sidebar sidebar fixed inset-y-0 left-0 z-30 flex w-[245px] flex-col px-4 py-5">
        <Brand invert />
        <div className="mb-2 mt-10 px-3 eyebrow !text-[#8298a4]">Workspace</div>
        {navMarkup()}
        <div className="mt-auto rounded-xl border border-[#304858] bg-[#1d3548] p-4">
          <div className="mb-2 flex items-center gap-2 text-[#a8dacf]">
            <ShieldCheck size={17} />
            <span className="text-xs font-semibold">Response network</span>
          </div>
          <p className="m-0 text-[11px] leading-relaxed text-[#c0cdd2]">Coordinating care across Bengaluru’s emergency services.</p>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[#aabac2]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#78c8b7]" /> Systems operational
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:ml-[245px]">
        <header className="topbar sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e3e9ec] bg-[#f8fafb]/95 px-7 backdrop-blur">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" className="rounded p-1 text-[#425b69] md:hidden" onClick={() => setMenu((v) => !v)}>
              <Menu size={21} />
            </button>
            <div>
              <span className="eyebrow hidden sm:block">SETA-HRC / {title}</span>
              <span className="text-xs text-[#7c8b93] sm:hidden">SETA-HRC</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {demo ? <DemoTag /> : <LiveTag />}
            <button
              onClick={() => nav(demo ? "/demo/notifications" : "/notifications")}
              className="relative rounded-lg p-2 text-[#526873] hover:bg-[#eaf0f2]"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <div className="hidden items-center gap-2 border-l border-[#e0e7ea] pl-3 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcebe7] text-xs font-bold text-[#2c6e62]">
                {role === "dispatcher" ? "AN" : role === "hospital" ? "RS" : role === "paramedic" ? "PM" : "OA"}
              </div>
              <div>
                <div className="text-xs font-semibold">
                  {currentUser?.name || (role === "dispatcher" ? "Asha Nair" : role === "hospital" ? "Dr. Rohan Shetty" : role === "paramedic" ? "Priya Menon" : "Operations Admin")}
                </div>
                <div className="text-[10px] capitalize text-[#829099]">{demo ? "Demo workspace" : role}</div>
              </div>
              <button
                aria-label="Sign out"
                onClick={() => {
                  logout();
                  nav("/");
                }}
                className="ml-1 rounded p-1.5 text-[#75858d] hover:bg-[#eaf0f2]"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {menu && (
          <div className="fixed inset-0 z-50 bg-[#101c27]/35 md:hidden" onClick={() => setMenu(false)}>
            <aside className="sidebar h-full w-[265px] p-5" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMenu(false)} className="mb-5 text-white"><X /></button>
              <Brand invert />
              {navMarkup()}
            </aside>
          </div>
        )}

        <main className="workspace-main mx-auto max-w-[1440px] px-7 py-7">
          {demo && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-lg border border-[#cce5dd] bg-[#edf6f3] px-4 py-2.5 text-xs text-[#396d63]">
              <span><strong>Sample simulation workspace.</strong> Records shown are in-memory demo records.</span>
              <span className="hidden font-mono text-[10px] sm:block">DEMO MODE</span>
            </div>
          )}
          {children}
        </main>
      </div>
      {navMarkup(true)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case Table Component
// ---------------------------------------------------------------------------
function CaseTable({ cases, onSelect, compact = false }: { cases: Emergency[]; onSelect?: (e: Emergency) => void; compact?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[#e8edef] text-[10px] uppercase tracking-[.1em] text-[#809099]">
            <th className="px-4 py-3 font-semibold">Case</th>
            <th className="px-4 py-3 font-semibold">Incident</th>
            <th className="px-4 py-3 font-semibold">Location</th>
            {!compact && <th className="px-4 py-3 font-semibold">Opened</th>}
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((e) => (
            <tr
              key={e.id}
              onClick={() => onSelect?.(e)}
              className={`border-b border-[#edf0f2] last:border-0 ${onSelect ? "cursor-pointer hover:bg-[#f8fafb]" : ""}`}
            >
              <td className="px-4 py-3.5">
                <div className="font-mono text-xs font-semibold text-[#304b5b]">{e.id}</div>
                <div className="mt-1 text-xs text-[#84929a]">{e.patientName} · {e.age}</div>
              </td>
              <td className="px-4 py-3.5">
                <div className="text-xs font-semibold">{e.category}</div>
                <div className="mt-1 max-w-[190px] truncate text-[10px] text-[#829099]">{e.symptoms}</div>
              </td>
              <td className="max-w-[205px] px-4 py-3.5 text-xs text-[#647781]">{e.location}</td>
              {!compact && (
                <td className="px-4 py-3.5 font-mono text-[11px] text-[#657680]">
                  {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
              )}
              <td className="px-4 py-3.5"><StatusBadge status={e.priority} /></td>
              <td className="px-4 py-3.5"><StatusBadge status={e.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {cases.length === 0 && (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#edf3f3] text-[#54747d]"><Search size={18} /></div>
          <h3 className="mt-3 text-sm font-semibold">No cases match this view</h3>
          <p className="mt-1 text-xs text-[#87949a]">Adjust filters or clear your search.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
function Dashboard({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;
  const ambulances = live && ops ? ops.ambulances : demoData.ambulances;
  const hospitals = live && ops ? ops.hospitals : demoData.hospitals;
  const audit = live && ops ? ops.audit : demoData.audit;
  const metrics = live && ops?.metrics ? ops.metrics : null;

  const urgent = metrics ? metrics.critical_cases : emergencies.filter((e) => e.priority === "Critical" && e.status !== "Closed").length;
  const active = metrics ? metrics.active_cases : emergencies.filter((e) => !["Arrived", "Closed"].includes(e.status)).length;
  const availUnits = metrics ? metrics.units_available : ambulances.filter((a) => a.status === "Available").length;
  const recvHosp = metrics ? metrics.receiving_hospitals : hospitals.filter((h) => h.status === "Available").length;

  return (
    <>
      <PageTitle
        title="Good morning, team"
        subtitle="Live emergency coordination across Bengaluru’s response network."
        action={<Button to="/emergencies/new"><Plus size={16} /> New emergency</Button>}
        demo={!live}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active cases" value={String(active).padStart(2, "0")} delta="Across all response stages" icon={Activity} />
        <Metric label="Critical priority" value={String(urgent).padStart(2, "0")} delta="Needs immediate attention" icon={Siren} tone="red" />
        <Metric label="Units available" value={String(availUnits).padStart(2, "0")} delta={`${ambulances.length} units in fleet`} icon={Ambulance} />
        <Metric label="Receiving hospitals" value={String(recvHosp).padStart(2, "0")} delta="With capacity available" icon={HospitalIcon} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_.8fr]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="m-0 text-[15px] font-semibold">Cases requiring attention</h2>
              <p className="mb-0 mt-1 text-xs text-[#7a8991]">Priority cases from the database queue</p>
            </div>
            <Button to="/emergencies" variant="quiet">All cases <ArrowRight size={14} /></Button>
          </div>
          <CaseTable cases={emergencies.filter((e) => e.priority === "Critical" || e.priority === "High").slice(0, 4)} compact />
        </section>

        <section className="surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="m-0 text-[15px] font-semibold">Network readiness</h2>
              <p className="mb-0 mt-1 text-xs text-[#7a8991]">Fleet availability status</p>
            </div>
            <Badge tone="mint">Operational</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {ambulances.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-[#edf0f2] pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf4f3] text-[#4b7e76]"><Ambulance size={16} /></span>
                  <div>
                    <div className="text-xs font-semibold">{a.unit}</div>
                    <div className="mt-0.5 text-[10px] text-[#819099]">{a.paramedicName} · {a.location}</div>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
          <Button to="/dispatch" variant="outline" className="mt-2 w-full">Open dispatch map <MapPin size={15} /></Button>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-[15px] font-semibold">Response activity</h2>
              <p className="mb-0 mt-1 text-xs text-[#7a8991]">Weekly emergency volume</p>
            </div>
            <Badge tone="blue">Past 7 days</Badge>
          </div>
          <div className="mt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{ d: "Mon", calls: 28 }, { d: "Tue", calls: 34 }, { d: "Wed", calls: 31 }, { d: "Thu", calls: 43 }, { d: "Fri", calls: 38 }, { d: "Sat", calls: 52 }, { d: "Sun", calls: 46 }]}>
                <defs>
                  <linearGradient id="mintFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#78c8b7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#78c8b7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf1f2" vertical={false} />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#819099" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#819099" }} />
                <Tooltip contentStyle={{ borderRadius: 9, borderColor: "#e0e8ea", fontSize: 12 }} />
                <Area type="monotone" dataKey="calls" stroke="#4b9b8a" strokeWidth={2.5} fill="url(#mintFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-[15px] font-semibold">Latest activity</h2>
              <p className="mb-0 mt-1 text-xs text-[#7a8991]">Operational audit log</p>
            </div>
            <Button to="/reports" variant="quiet">Audit log <ArrowRight size={14} /></Button>
          </div>
          <div className="mt-4 space-y-4">
            {audit.slice(0, 4).map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#78c8b7]" />
                <div>
                  <div className="text-xs font-semibold">{a.action}</div>
                  <div className="mt-1 text-[11px] text-[#798991]">{a.target}</div>
                  <div className="mt-1 font-mono text-[9px] text-[#9aa5aa]">{a.createdAt} · {a.actor}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Emergencies & Triage Queue Page
// ---------------------------------------------------------------------------
function Emergencies({ onlyTriage = false, live = false, ops }: { onlyTriage?: boolean; live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const [selected, setSelected] = useState<Emergency | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const cases = useMemo(
    () =>
      emergencies.filter(
        (e) =>
          (!onlyTriage || ["New", "Triaged"].includes(e.status)) &&
          (priority === "All priorities" || e.priority === priority) &&
          `${e.id} ${e.patientName} ${e.location} ${e.category}`.toLowerCase().includes(search.toLowerCase())
      ),
    [emergencies, onlyTriage, priority, search]
  );

  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(cases.length / pageSize));
  const pageCases = cases.slice((page - 1) * pageSize, page * pageSize);

  const handleMarkTriaged = async (caseId: string) => {
    setBusy(true);
    try {
      if (live && ops) {
        await ops.setEmergencyStatus(caseId, "Triaged", "Confirmed by dispatcher");
      } else {
        setDemoEmergencyStatus(caseId, "Triaged");
      }
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title={onlyTriage ? "Priority triage queue" : "Emergency cases"}
        subtitle={
          onlyTriage
            ? "Deterministic clinical priority cues and queue ordered by acuity."
            : "Search, filter and coordinate active emergency incidents."
        }
        action={!onlyTriage && <Button to="/emergencies/new"><Plus size={16} /> Register case</Button>}
        demo={!live}
      />

      {onlyTriage && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="surface p-4">
            <div className="eyebrow">Awaiting review</div>
            <div className="mt-2 font-mono text-2xl">{emergencies.filter((e) => e.status === "New").length.toString().padStart(2, "0")}</div>
          </div>
          <div className="surface p-4">
            <div className="eyebrow">Critical & high acuity</div>
            <div className="mt-2 font-mono text-2xl text-[#b92736]">{emergencies.filter((e) => ["Critical", "High"].includes(e.priority)).length.toString().padStart(2, "0")}</div>
          </div>
          <div className="surface p-4">
            <div className="eyebrow">Acuity ordering</div>
            <div className="mt-2 text-xs text-[#667880]">Critical &gt; High &gt; Moderate &gt; Low priority ranking.</div>
          </div>
        </div>
      )}

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edef] p-4">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#e0e7ea] bg-[#fbfcfc] px-3 py-2 text-[#84929a]">
            <Search size={16} />
            <input
              aria-label="Search cases"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search ID, patient, symptom or area"
              className="w-full border-0 bg-transparent text-xs text-[#203345] outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#788890]">
            <Filter size={14} />
            <select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}
              className="rounded-lg border border-[#e0e7ea] bg-white px-3 py-2 text-xs text-[#405662]"
            >
              <option>All priorities</option>
              {["Critical", "High", "Moderate", "Low"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="text-[11px] text-[#809099]">{cases.length} cases found</div>
        </div>

        <CaseTable cases={pageCases} onSelect={setSelected} />

        <div className="flex items-center justify-between border-t border-[#edf0f2] px-4 py-3 text-[11px] text-[#829099]">
          <span>Showing {cases.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, cases.length)} of {cases.length} records</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-[#e1e7ea] px-2.5 py-1.5 disabled:opacity-50">
              Previous
            </button>
            <span className="rounded border border-[#d8e8e3] bg-[#eaf4f1] px-2.5 py-1.5 text-[#286e61]">{page} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded border border-[#e1e7ea] px-2.5 py-1.5 disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#14222d]/35" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-[440px] overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <span className="eyebrow">Case details</span>
                <h2 className="mt-1 font-mono text-xl">{selected.id}</h2>
              </div>
              <button aria-label="Close details" onClick={() => setSelected(null)}><X size={19} /></button>
            </div>
            <div className="mt-4 flex gap-2">
              <StatusBadge status={selected.priority} />
              <StatusBadge status={selected.status} />
            </div>
            <h3 className="mt-7 text-sm font-semibold">Patient & caller</h3>
            <p className="text-sm text-[#6e7f88]">{selected.patientName}, {selected.age} yrs · Caller: {selected.callerName}<br />{selected.phone}</p>
            <h3 className="mt-6 text-sm font-semibold">Incident report</h3>
            <p className="text-sm text-[#6e7f88]">{selected.symptoms}</p>
            <p className="flex gap-2 text-sm text-[#6e7f88]"><MapPin size={16} />{selected.location}</p>
            <div className="mt-5 rounded-xl bg-[#f4f7f8] p-4">
              <div className="eyebrow">Triage clinical rationale</div>
              <p className="mb-0 mt-2 text-sm leading-5">{selected.priorityReason}</p>
            </div>
            <h3 className="mt-6 text-sm font-semibold">Case timeline</h3>
            {selected.history.map((item, i) => (
              <div key={i} className="flex gap-3 border-l border-[#dbe5e5] py-2 pl-4">
                <span className="font-mono text-[10px] text-[#839199]">{item.at}</span>
                <span className="text-xs">{item.event}</span>
              </div>
            ))}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => handleMarkTriaged(selected.id)} disabled={busy} variant="outline">
                {busy ? "Updating…" : "Mark triaged"}
              </Button>
              <Button to="/hospitals">Find hospital</Button>
              <Button to="/dispatch">Assign unit</Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// New Emergency Registration Page
// ---------------------------------------------------------------------------
function NewEmergency({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError("");
    const fd = new FormData(ev.currentTarget);
    const payload = {
      patientName: String(fd.get("patientName")).trim(),
      age: Number(fd.get("age")),
      callerName: String(fd.get("callerName")).trim(),
      phone: String(fd.get("phone")).trim(),
      location: String(fd.get("location")).trim(),
      symptoms: String(fd.get("symptoms")).trim(),
      category: String(fd.get("category"))
    };

    if (
      !payload.patientName ||
      !payload.callerName ||
      !payload.location ||
      !payload.symptoms ||
      !Number.isInteger(payload.age) ||
      payload.age < 0 ||
      payload.age > 120 ||
      payload.phone.replace(/\D/g, "").length < 7
    ) {
      setError("Please complete all required fields. Age must be valid (0-120) and phone must have at least 7 digits.");
      return;
    }

    setBusy(true);
    try {
      if (live && ops) {
        const item = await ops.createEmergency(payload);
        nav("/emergencies");
      } else {
        const item = createDemoEmergency(payload);
        addDemoAudit("Emergency registered", item.id, "New case intake");
        nav("/demo/emergencies");
      }
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Register emergency"
        subtitle="Capture essential caller & patient incident details. Automatic triage suggests clinical priority."
        demo={!live}
      />
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <form onSubmit={submit} className="surface p-5 md:p-7" noValidate>
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#dce7e8] bg-[#f8fbfa] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f4f1] text-[#377e71]">
              <ClipboardList size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">Incident Intake</div>
              <div className="mt-1 text-xs leading-5 text-[#76868e]">
                Enter incident symptoms and location. Triage analysis evaluates severity and assigns queue ranking immediately upon submission.
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["patientName", "Patient name", "text", "e.g. Ramesh Sharma"],
              ["age", "Age (years)", "number", "Age"],
              ["callerName", "Caller name", "text", "Name of caller"],
              ["phone", "Contact number", "tel", "Contact phone"],
              ["location", "Incident location / address", "text", "Street, cross, or landmark in Bengaluru"]
            ].map(([name, label, type, placeholder]) => (
              <label key={name} className={`block ${name === "location" ? "sm:col-span-2" : ""}`}>
                <span className="mb-1.5 block text-xs font-semibold text-[#415763]">
                  {label} <span className="text-[#b92736]">*</span>
                </span>
                <input
                  required
                  name={name}
                  type={type}
                  min={name === "age" ? "0" : undefined}
                  max={name === "age" ? "120" : undefined}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] px-3 py-2.5 text-sm outline-none focus:border-[#6eaa9c]"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-[#415763]">
              Incident category <span className="text-[#b92736]">*</span>
            </span>
            <select name="category" className="w-full rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] px-3 py-2.5 text-sm">
              <option>Cardiac</option>
              <option>Stroke</option>
              <option>Trauma</option>
              <option>Respiratory</option>
              <option>Injury</option>
              <option>Medical</option>
            </select>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-[#415763]">
              Symptoms and clinical observations <span className="text-[#b92736]">*</span>
            </span>
            <textarea
              required
              name="symptoms"
              rows={4}
              placeholder="Describe symptoms, patient responsiveness, onset time, and vital observations."
              className="w-full resize-y rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] px-3 py-2.5 text-sm outline-none focus:border-[#6eaa9c]"
            />
          </label>

          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-[#f0c7ca] bg-[#fff2f2] p-3 text-xs text-[#a32331]">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#edf0f2] pt-5">
            <Button to={live ? "/emergencies" : "/demo/emergencies"} variant="outline">Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Registering case…" : <><Plus size={15} /> Create emergency</>}
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="surface p-5">
            <div className="flex items-center gap-2">
              <Activity size={17} className="text-[#4a8d7f]" />
              <h2 className="m-0 text-sm font-semibold">Triage protocol</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#71818a]">
              The system categorizes acuity from symptom cues and category. All recommendations require dispatcher review.
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><StatusBadge status="Critical" /><span className="text-[#7e8c93]">Immediate resuscitation</span></div>
              <div className="flex justify-between"><StatusBadge status="High" /><span className="text-[#7e8c93]">Urgent clinical needs</span></div>
              <div className="flex justify-between"><StatusBadge status="Moderate" /><span className="text-[#7e8c93]">Stable acute symptoms</span></div>
              <div className="flex justify-between"><StatusBadge status="Low" /><span className="text-[#7e8c93]">Non-urgent queue</span></div>
            </div>
          </div>
          <div className="surface p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#4a8d7f]" />
              <h2 className="m-0 text-sm font-semibold">Simulated environment</h2>
            </div>
            <p className="mb-0 mt-3 text-xs leading-5 text-[#71818a]">
              All data entered is stored in the demonstration database. Fictional patient records only.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hospital Coordination & Recommendation Scoring Page
// ---------------------------------------------------------------------------
function Hospitals({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;
  const hospitals = live && ops ? ops.hospitals : demoData.hospitals;

  const [caseId, setCaseId] = useState(emergencies[0]?.id || "");
  const [recommendations, setRecommendations] = useState<HospitalRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [reason, setReason] = useState("");
  const [chosen, setChosen] = useState("");
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const current = emergencies.find((e) => e.id === caseId);

  // Fetch explainable recommendation ranking from backend when caseId changes
  useEffect(() => {
    if (!caseId) return;
    if (live) {
      setLoadingRecs(true);
      emergenciesService
        .getRecommendations(caseId)
        .then((recs) => {
          setRecommendations(recs);
        })
        .catch(() => {})
        .finally(() => setLoadingRecs(false));
    }
  }, [caseId, live]);

  const handleApproveRecommendation = async (hId: string, isOverride: boolean) => {
    if (reason.trim().length < 5) {
      setErr("Please provide a documented clinical or operational rationale (at least 5 characters).");
      return;
    }
    setErr("");
    try {
      if (live && ops) {
        await ops.approveHospital(caseId, hId, reason.trim(), isOverride);
        setSuccessMsg(`Hospital ${hId} confirmed for case ${caseId}.`);
      } else {
        decideDemoHospital(caseId, hId, reason.trim());
        addDemoAudit("Hospital recommendation approved", `${caseId} · ${hId}`, reason.trim());
        setSuccessMsg(`Selection confirmed for ${hId}.`);
      }
      setChosen("");
      setReason("");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e: any) {
      setErr(errorMessage(e));
    }
  };

  // Determine display list: recommendations if live, else sorted by distance
  const displayHospitals = useMemo(() => {
    if (live && recommendations.length > 0) {
      return recommendations.map((r) => {
        const hObj = hospitals.find((h) => h.id === r.hospital_id);
        return {
          ...r,
          id: r.hospital_id,
          name: r.hospital_name,
          bedsAvailable: r.beds_available,
          icuAvailable: r.icu_available,
          oxygenAvailable: r.oxygen_available,
          capabilities: hObj?.capabilities || [],
          departments: hObj?.departments || []
        };
      });
    }
    return [...hospitals].sort((a, b) => a.distanceKm - b.distanceKm);
  }, [live, recommendations, hospitals]);

  return (
    <>
      <PageTitle
        title="Hospital coordination & recommendation"
        subtitle="Multi-factor scoring algorithm balances capability fit, available resources, route distance, and operational load."
        demo={!live}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e8ea] bg-white p-4">
        <label className="flex items-center gap-2 text-xs font-semibold">
          Active incident:
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            className="rounded-lg border border-[#dbe4e7] bg-white px-3 py-2 text-xs font-normal"
          >
            {emergencies.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.category} · {e.patientName}
              </option>
            ))}
          </select>
        </label>
        {current && (
          <div className="flex items-center gap-3">
            <StatusBadge status={current.priority} />
            <span className="text-xs text-[#74848c] max-w-sm truncate">{current.symptoms}</span>
          </div>
        )}
      </div>

      {successMsg && (
        <div role="status" className="mb-4 rounded-lg border border-[#bde0d6] bg-[#edf8f5] p-3 text-xs text-[#286e61]">
          {successMsg}
        </div>
      )}

      {loadingRecs && (
        <div className="p-8 text-center text-xs text-[#627783]"><RefreshCw className="mx-auto mb-2 animate-spin" size={20} /> Computing multi-factor hospital scores…</div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {displayHospitals.map((h: any, i: number) => {
          const isRecommended = current?.recommendedHospitalId === h.id || (h.rank === 1 && !current?.recommendedHospitalId);
          const hasScore = typeof h.total_score === "number";

          return (
            <article
              key={h.id}
              className={`surface p-5 transition-all ${
                current?.recommendedHospitalId === h.id
                  ? "border-[#5fa393] ring-2 ring-[#5fa393]/30"
                  : h.rank === 1
                  ? "border-[#78c8b7]"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="m-0 text-[15px] font-semibold">{h.name}</h2>
                    {h.rank === 1 && <Badge tone="mint"><Sparkles size={12} /> Top match ({h.total_score}/100)</Badge>}
                    {h.rank > 1 && hasScore && <Badge tone="neutral">Rank #{h.rank} ({h.total_score}/100)</Badge>}
                  </div>
                  <p className="mb-0 mt-1 flex items-center gap-1 text-xs text-[#788991]">
                    <MapPin size={13} /> {h.location} · {h.distanceKm || h.distance_km} km
                  </p>
                </div>
                <StatusBadge status={h.status} />
              </div>

              {/* Explainable factor breakdown if available */}
              {h.factors && (
                <div className="mt-3 rounded-lg border border-[#e4ebed] bg-[#f8fbfa] p-3 text-xs">
                  <div className="mb-2 font-semibold text-[#324b58]">Factor breakdown:</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div>Capability fit: <strong>{h.factors.capability_fit}/100</strong></div>
                    <div>Resources: <strong>{h.factors.available_resources}/100</strong></div>
                    <div>Route distance: <strong>{h.factors.route_distance_km} km</strong></div>
                    <div>Load penalty: <strong>-{h.factors.load_penalty}</strong></div>
                  </div>
                  {h.missing_data_flags && h.missing_data_flags.length > 0 && (
                    <div className="mt-2 text-[10px] text-[#a04b32]">
                      Flags: {h.missing_data_flags.join("; ")}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["General beds", String(h.bedsAvailable)],
                  ["ICU beds", String(h.icuAvailable)],
                  ["Oxygen", h.oxygenAvailable ? "Available" : "Limited"]
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-[#f5f8f8] p-3">
                    <div className="eyebrow">{label}</div>
                    <div className="mt-1 text-sm font-semibold">{val}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="eyebrow">Capabilities</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {h.capabilities.map((c: string) => (
                    <Badge key={c} tone={current?.category?.toLowerCase() === c.toLowerCase() ? "mint" : "neutral"}>
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#edf0f2] pt-4">
                <span className="text-xs text-[#788991] max-w-[240px] truncate">{h.departments?.join(" · ")}</span>
                <Button
                  onClick={() => {
                    setChosen(h.id);
                    setErr("");
                  }}
                  variant={current?.recommendedHospitalId === h.id ? "quiet" : "outline"}
                >
                  {current?.recommendedHospitalId === h.id ? "Approved destination" : "Review & select"}
                </Button>
              </div>

              {chosen === h.id && (
                <div className="mt-4 rounded-lg bg-[#f6f9f8] p-3">
                  <label className="block text-xs font-semibold">
                    Documented rationale / approval note <span className="text-[#b92736]">*</span>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Confirmed ICU availability and specialized Cardiology team"
                      className="mt-2 w-full rounded-lg border border-[#dbe4e7] bg-white px-3 py-2 text-xs outline-none"
                    />
                  </label>
                  {err && <p role="alert" className="mt-2 text-xs text-[#b92736]">{err}</p>}
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="quiet" onClick={() => setChosen("")}>Cancel</Button>
                    <Button onClick={() => handleApproveRecommendation(h.id, h.rank !== 1)}>
                      Confirm selection
                    </Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Map View Component
// ---------------------------------------------------------------------------
function MapView({ emergencies }: { emergencies: Emergency[] }) {
  const center: [number, number] = [12.9716, 77.5946];
  const icon = L.divIcon({
    className: "",
    html: '<div class="map-pin"><span>+</span></div>',
    iconSize: [27, 27],
    iconAnchor: [13, 27]
  });

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {emergencies
        .filter((e) => !["Arrived", "Closed"].includes(e.status))
        .map((e) => (
          <Marker key={e.id} position={[e.lat, e.lng]} icon={icon}>
            <MapTooltip>{e.id} · {e.priority} ({e.category})</MapTooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}

// ---------------------------------------------------------------------------
// Dispatch Control Page
// ---------------------------------------------------------------------------
function Dispatch({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;
  const ambulances = live && ops ? ops.ambulances : demoData.ambulances;

  const [caseId, setCaseId] = useState(emergencies[0]?.id || "");
  const [selectedAmbulance, setSelectedAmbulance] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const item = emergencies.find((e) => e.id === caseId);

  const handleAssign = async () => {
    if (!item || !selectedAmbulance) return;
    setBusy(true);
    setMessage("");
    try {
      if (live && ops) {
        await ops.assignAmbulance(item.id, selectedAmbulance);
        setMessage(`Unit ${selectedAmbulance} assigned to ${item.id} successfully.`);
      } else {
        assignDemoAmbulance(item.id, selectedAmbulance);
        addDemoAudit("Ambulance assigned", `${item.id} · ${selectedAmbulance}`, "Dispatcher assignment");
        setMessage(`${selectedAmbulance} assigned to ${item.id}.`);
      }
      setSelectedAmbulance("");
    } catch (e: any) {
      setMessage(`Error: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Dispatch control"
        subtitle="Assign available ambulances and track crew deployment across the response network."
        demo={!live}
      />
      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <section className="surface overflow-hidden p-3">
          <div className="mb-3 flex items-center justify-between px-2 pt-1">
            <div>
              <h2 className="m-0 text-sm font-semibold">Live response map</h2>
              <p className="m-0 mt-1 text-[11px] text-[#829099]">Bengaluru incident markers</p>
            </div>
            <Badge tone="mint">{ambulances.filter((a) => a.status === "Available").length} units available</Badge>
          </div>
          <MapView emergencies={emergencies} />
        </section>

        <div className="space-y-4">
          <section className="surface p-5">
            <h2 className="m-0 text-sm font-semibold">Assign a unit</h2>
            <label className="mt-4 block text-xs font-semibold">
              Emergency
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#dbe4e7] bg-white px-3 py-2.5 text-xs"
              >
                {emergencies
                  .filter((e) => !["Arrived", "Closed"].includes(e.status))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id} · {e.category} · {e.priority}
                    </option>
                  ))}
              </select>
            </label>

            {item && (
              <div className="mt-3 rounded-lg bg-[#f6f9f9] p-3">
                <div className="text-xs font-semibold">{item.patientName} · {item.age} yrs</div>
                <div className="mt-1 flex gap-1 text-[11px] text-[#73828a]"><MapPin size={12} />{item.location}</div>
                <div className="mt-2"><StatusBadge status={item.priority} /></div>
              </div>
            )}

            <label className="mt-4 block text-xs font-semibold">
              Available ambulance
              <select
                value={selectedAmbulance}
                onChange={(e) => setSelectedAmbulance(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#dbe4e7] bg-white px-3 py-2.5 text-xs"
              >
                <option value="">Choose available unit</option>
                {ambulances
                  .filter((a) => a.status === "Available")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.unit} ({a.id}) · {a.paramedicName} ({a.location})
                    </option>
                  ))}
              </select>
            </label>

            <Button
              className="mt-4 w-full"
              disabled={!selectedAmbulance || !item || busy}
              onClick={handleAssign}
            >
              <Ambulance size={16} /> {busy ? "Assigning unit…" : "Assign ambulance"}
            </Button>

            {message && <p role="status" className="mb-0 mt-3 text-xs text-[#327a6c]">{message}</p>}
          </section>

          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-sm font-semibold">Fleet status</h2>
              <Button to="/paramedic" variant="quiet">Crew view <ArrowRight size={13} /></Button>
            </div>
            <div className="mt-3 space-y-3">
              {ambulances.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-[#edf0f2] pb-2.5 last:border-0">
                  <div>
                    <div className="text-xs font-semibold">{a.unit}</div>
                    <div className="mt-1 text-[10px] text-[#819099]">{a.paramedicName} · {a.location}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hospital Desk Page (Accept/Reject & Resource Reservations)
// ---------------------------------------------------------------------------
function HospitalDesk({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;
  const hospitals = live && ops ? ops.hospitals : demoData.hospitals;
  const audit = live && ops ? ops.audit : demoData.audit;

  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id || "H-01");
  const h = hospitals.find((x) => x.id === hospitalId) || hospitals[0];
  const [selectedCase, setSelectedCase] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reserveIcu, setReserveIcu] = useState(false);

  const inboundCases = emergencies.filter((e) => e.recommendedHospitalId === hospitalId);

  const handleDecision = async (caseId: string, decision: "Accepted" | "Rejected", reasonTxt: string) => {
    try {
      if (live && ops) {
        await ops.decideIncomingCase(caseId, decision, reasonTxt, hospitalId, reserveIcu);
      } else {
        decideDemoHospital(caseId, hospitalId, reasonTxt);
        addDemoAudit(`Hospital inbound ${decision.toLowerCase()}`, caseId, reasonTxt);
      }
      setMessage(`Case ${caseId} was ${decision.toLowerCase()}.`);
      setShowRejectModal(null);
      setRejectReason("");
      setTimeout(() => setMessage(""), 4000);
    } catch (e: any) {
      setMessage(`Error: ${errorMessage(e)}`);
    }
  };

  return (
    <>
      <PageTitle
        title="Hospital desk"
        subtitle="Review inbound patient referrals, confirm receiving capacity, and transactionally reserve beds."
        demo={!live}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#e0e8ea] bg-white p-4">
        <label className="text-xs font-semibold">
          Facility:
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className="ml-3 rounded-lg border border-[#dbe4e7] bg-white px-3 py-2 text-xs font-normal"
          >
            {hospitals.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
        {h && <StatusBadge status={h.status} />}
        {h && <span className="text-xs text-[#829099]">{h.location}</span>}
      </div>

      {message && (
        <div role="status" className="mb-4 rounded-lg border border-[#bde0d6] bg-[#edf8f5] p-3 text-xs text-[#286e61]">
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        {h && <Resources hospital={h} live={live} ops={ops} />}

        <section className="surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="m-0 text-sm font-semibold">Inbound referrals</h2>
              <p className="mb-0 mt-1 text-xs text-[#819099]">Review destination referrals and allocate receiving beds.</p>
            </div>
            <Badge tone="blue">{inboundCases.length} assigned</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {inboundCases.map((e) => (
              <div key={e.id} className="rounded-xl border border-[#e4eaec] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold">{e.id}</span>
                  <StatusBadge status={e.priority} />
                </div>
                <div className="mt-2 text-xs text-[#657780]">{e.category} · {e.symptoms}</div>
                <div className="mt-2 text-[10px] text-[#87949a]">{e.patientName}, {e.age} yrs · Location: {e.location}</div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f2] pt-3">
                  <StatusBadge status={e.status} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectModal(e.id)}
                    >
                      Reject referral
                    </Button>
                    <Button
                      onClick={() => handleDecision(e.id, "Accepted", "Receiving trauma & cardiology team prepared")}
                    >
                      <Check size={14} /> Accept & reserve bed
                    </Button>
                  </div>
                </div>

                {showRejectModal === e.id && (
                  <div className="mt-3 rounded-lg bg-[#fff5f5] p-3 text-xs">
                    <label className="block font-semibold text-[#8a2432]">
                      Rejection reason:
                      <input
                        value={rejectReason}
                        onChange={(ev) => setRejectReason(ev.target.value)}
                        placeholder="e.g. Critical overload in trauma resuscitation bay"
                        className="mt-1.5 w-full rounded-lg border border-[#e8c0c4] bg-white p-2 text-xs"
                      />
                    </label>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant="quiet" onClick={() => setShowRejectModal(null)}>Cancel</Button>
                      <Button
                        variant="danger"
                        disabled={rejectReason.trim().length < 4}
                        onClick={() => handleDecision(e.id, "Rejected", rejectReason.trim())}
                      >
                        Confirm rejection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {inboundCases.length === 0 && (
              <Empty title="No inbound referrals" body="New referrals assigned to this hospital will appear here." />
            )}
          </div>
        </section>
      </div>

      <section className="surface mt-5 p-5">
        <h2 className="m-0 text-sm font-semibold">Recent resource history</h2>
        <p className="mb-4 mt-1 text-xs text-[#819099]">Audit trail of capacity changes and reservations</p>
        {audit.slice(0, 4).map((x) => (
          <div key={x.id} className="flex items-center justify-between border-t border-[#edf0f2] py-3 text-xs">
            <span>{x.action} · {x.target}</span>
            <span className="font-mono text-[10px] text-[#8b989e]">{x.createdAt}</span>
          </div>
        ))}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Facility Capacity Component
// ---------------------------------------------------------------------------
function Resources({ hospital, live = false, ops }: { hospital: Hospital; live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const [beds, setBeds] = useState(String(hospital.bedsAvailable));
  const [icu, setIcu] = useState(String(hospital.icuAvailable));
  const [oxygen, setOxygen] = useState(hospital.oxygenAvailable);
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setBeds(String(hospital.bedsAvailable));
    setIcu(String(hospital.icuAvailable));
    setOxygen(hospital.oxygenAvailable);
  }, [hospital.id, hospital.bedsAvailable, hospital.icuAvailable, hospital.oxygenAvailable]);

  const handleSave = async () => {
    const b = Number(beds);
    const i = Number(icu);
    if (isNaN(b) || b < 0 || isNaN(i) || i < 0) {
      setErr("Resource quantities cannot be negative or empty.");
      return;
    }
    setErr("");
    try {
      if (live && ops) {
        await ops.updateResources(hospital.id, {
          beds_available: b,
          icu_available: i,
          oxygen_available: oxygen
        });
      } else {
        updateDemoResources(hospital.id, {
          bedsAvailable: b,
          icuAvailable: i,
          oxygenAvailable: oxygen
        });
        addDemoAudit("Hospital resources updated", hospital.name, "Shift capacity update");
      }
      setSaved("Resource availability saved.");
      setTimeout(() => setSaved(""), 3000);
    } catch (e: any) {
      setErr(errorMessage(e));
    }
  };

  return (
    <section className="surface p-5">
      <div className="flex items-center gap-2">
        <HospitalIcon size={18} className="text-[#438777]" />
        <h2 className="m-0 text-sm font-semibold">Facility resources</h2>
      </div>
      <p className="mb-5 mt-1 text-xs text-[#7d8c93]">Managed operational capacity for {hospital.name}.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          General beds available
          <input
            type="number"
            min="0"
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#dbe4e7] px-3 py-2.5 text-sm"
          />
        </label>
        <label className="text-xs font-semibold">
          ICU beds available
          <input
            type="number"
            min="0"
            value={icu}
            onChange={(e) => setIcu(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#dbe4e7] px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-4 flex items-center justify-between rounded-lg bg-[#f5f8f8] p-3 text-xs font-semibold">
        Oxygen supply operational
        <input
          type="checkbox"
          checked={oxygen}
          onChange={(e) => setOxygen(e.target.checked)}
          className="h-4 w-4 accent-[#397e72]"
        />
      </label>

      {err && <p role="alert" className="mt-3 text-xs text-[#b92736]">{err}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave}><Check size={15} /> Save resources</Button>
        {saved && <span role="status" className="text-xs text-[#347c6e]">{saved}</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Paramedic View Page
// ---------------------------------------------------------------------------
function Paramedic({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;
  const hospitals = live && ops ? ops.hospitals : demoData.hospitals;

  const assigned = emergencies.filter((e) => e.assignedAmbulanceId);
  const [caseId, setCaseId] = useState(assigned[0]?.id || "");
  const [handover, setHandover] = useState("");
  const [msg, setMsg] = useState("");

  const item = emergencies.find((e) => e.id === caseId) || assigned[0];

  const handleStatusChange = async (newStatus: "At scene" | "Transporting" | "Arrived") => {
    if (!item) return;
    try {
      if (live && ops) {
        await ops.setEmergencyStatus(item.id, newStatus, `Paramedic crew updated status to ${newStatus}`);
      } else {
        setDemoEmergencyStatus(item.id, newStatus);
        addDemoAudit("Crew status updated", item.id, newStatus);
      }
      setMsg(`Status updated to ${newStatus}.`);
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) {
      setMsg(`Error: ${errorMessage(e)}`);
    }
  };

  const handleHandover = async () => {
    if (!item || handover.trim().length < 8) return;
    try {
      if (live && ops) {
        await ops.setEmergencyStatus(item.id, item.status, `Handover note: ${handover.trim()}`);
      } else {
        addDemoAudit("Handover note added", item.id, handover.trim());
      }
      setMsg("Patient handover notes submitted.");
      setHandover("");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) {
      setMsg(`Error: ${errorMessage(e)}`);
    }
  };

  return (
    <>
      <PageTitle
        title="Paramedic crew response"
        subtitle="Assigned incident telemetry, destination details and clinical handover recording."
        demo={!live}
      />

      <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
        <section className="surface p-5">
          <h2 className="m-0 text-sm font-semibold">Active assignments</h2>
          <p className="mb-4 mt-1 text-xs text-[#829099]">Select a dispatched incident.</p>
          {assigned.map((e) => (
            <button
              key={e.id}
              onClick={() => setCaseId(e.id)}
              className={`mb-2 w-full rounded-xl border p-3 text-left transition ${
                caseId === e.id ? "border-[#72aa9c] bg-[#f0f7f5]" : "border-[#e4eaec] bg-white hover:bg-[#fafcfc]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold">{e.id}</span>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-2 text-xs text-[#697b83]">{e.category} · {e.location}</div>
            </button>
          ))}
          {!assigned.length && <Empty title="No active assignments" body="New dispatch assignments will show here." />}
        </section>

        {item ? (
          <section className="space-y-4">
            <div className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="eyebrow">Active deployment</div>
                  <h2 className="mt-1 font-mono text-xl">{item.id}</h2>
                </div>
                <StatusBadge status={item.priority} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[#f5f8f8] p-3">
                  <div className="eyebrow">Incident pickup</div>
                  <div className="mt-1 text-xs font-semibold">{item.location}</div>
                </div>
                <div className="rounded-lg bg-[#f5f8f8] p-3">
                  <div className="eyebrow">Target hospital</div>
                  <div className="mt-1 text-xs font-semibold">
                    {hospitals.find((h) => h.id === item.recommendedHospitalId)?.name || "Pending hospital assignment"}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="eyebrow">Response progression</div>
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {["Dispatched", "At scene", "Transporting", "Arrived"].map((s, i) => {
                    const done = ["Dispatched", "At scene", "Transporting", "Arrived"].indexOf(item.status) >= i;
                    return (
                      <div key={s}>
                        <div className={`h-1.5 rounded-full ${done ? "bg-[#69ad9d]" : "bg-[#e5ebed]"}`} />
                        <div className="mt-2 text-[9px] text-[#798991] sm:text-[10px]">{s}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {(["At scene", "Transporting", "Arrived"] as const).map((s) => (
                  <Button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    variant={item.status === s ? "primary" : "outline"}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="surface p-5">
              <h2 className="m-0 text-sm font-semibold">Clinical handover documentation</h2>
              <p className="mb-3 mt-1 text-xs text-[#819099]">Document patient condition, interventions performed, and vitals for receiving staff.</p>
              <textarea
                rows={3}
                value={handover}
                onChange={(e) => setHandover(e.target.value)}
                placeholder="Observed vitals, IV access established, oxygen administered, response to treatment…"
                className="w-full rounded-lg border border-[#dbe4e7] p-3 text-xs outline-none focus:border-[#6eaa9c]"
              />
              <div className="mt-3 flex items-center justify-between">
                <Button onClick={handleHandover} disabled={handover.trim().length < 8}>
                  <Check size={14} /> Submit handover notes
                </Button>
                {msg && <span className="text-xs text-[#327a6c]">{msg}</span>}
              </div>
            </div>
          </section>
        ) : (
          <Empty title="Select an assignment" body="Assigned incidents appear in this panel." />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Notifications Page
// ---------------------------------------------------------------------------
function Notifications({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const notifications = live && ops ? ops.notifications : demoData.notifications;

  const handleRead = async (id: string) => {
    if (live && ops) {
      await ops.markNotificationRead(id);
    } else {
      markDemoNotificationRead(id);
    }
  };

  return (
    <>
      <PageTitle title="Notifications" subtitle="Operational alerts and coordination stream." demo={!live} />
      <div className="space-y-3">
        {notifications.map((n) => (
          <article
            key={n.id}
            className={`surface flex items-start gap-4 p-4 ${!n.read ? "border-l-[3px] border-l-[#78c8b7]" : ""}`}
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              n.type === "urgent" ? "bg-[#fff0f0] text-[#b92736]" : "bg-[#eaf3f2] text-[#438578]"
            }`}>
              {n.type === "urgent" ? <Siren size={17} /> : <Bell size={17} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-sm font-semibold">{n.title}</h2>
                <span className="font-mono text-[10px] text-[#8a989f]">{n.createdAt}</span>
              </div>
              <p className="mb-0 mt-1 text-xs text-[#75858d]">{n.message}</p>
            </div>
            {!n.read && (
              <Button variant="quiet" onClick={() => handleRead(n.id)}>Mark read</Button>
            )}
          </article>
        ))}
      </div>
      {notifications.length === 0 && <Empty title="You are all caught up" body="New coordination updates will appear here." />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Analytics & AI Analytics Page
// ---------------------------------------------------------------------------
function Analytics({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const emergencies = live && ops ? ops.emergencies : demoData.emergencies;
  const hospitals = live && ops ? ops.hospitals : demoData.hospitals;

  const [evaluation, setEvaluation] = useState<EvaluationMetrics | null>(null);
  const [nlpText, setNlpText] = useState("");
  const [nlpResult, setNlpResult] = useState<TextClassificationResult | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);

  useEffect(() => {
    if (live) {
      analyticsService.getEvaluation().then(setEvaluation).catch(() => {});
    }
  }, [live]);

  const handleTestClassifier = async (sampleText: string) => {
    setNlpText(sampleText);
    setNlpLoading(true);
    try {
      const res = await analyticsService.classifyText(sampleText);
      setNlpResult(res);
    } catch {
      // Fallback
    } finally {
      setNlpLoading(false);
    }
  };

  const chart = [
    { d: "Mon", cases: 28, urgent: 5 },
    { d: "Tue", cases: 34, urgent: 7 },
    { d: "Wed", cases: 31, urgent: 6 },
    { d: "Thu", cases: 43, urgent: 9 },
    { d: "Fri", cases: 38, urgent: 6 },
    { d: "Sat", cases: 52, urgent: 11 },
    { d: "Sun", cases: 46, urgent: 8 }
  ];

  return (
    <>
      <PageTitle
        title="Response analytics & AI evaluation"
        subtitle="Operational metrics from the database and explainable algorithm evaluation."
        demo={!live}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Recorded cases" value={String(emergencies.length)} delta="Simulated database cases" icon={ClipboardList} />
        <Metric label="High & critical acuity" value={String(emergencies.filter((e) => ["High", "Critical"].includes(e.priority)).length)} delta="Acuity priority cases" icon={Activity} tone="amber" />
        <Metric label="Resolved cases" value={String(emergencies.filter((e) => ["Arrived", "Closed"].includes(e.status)).length)} delta="Handed over or closed" icon={Check} />
      </div>

      {/* Algorithmic Evaluation Comparison Module */}
      {evaluation && (
        <div className="surface mt-5 border border-[#83c4b5]/40 bg-[#f4faf8] p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#327a6c]" />
            <h2 className="m-0 text-sm font-semibold text-[#1f423b]">Algorithmic Evaluation: SETA Multi-factor vs. Baselines</h2>
          </div>
          <p className="mt-2 text-xs text-[#52776f] leading-5">{evaluation.summary}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3 shadow-xs">
              <div className="eyebrow">Average route distance</div>
              <div className="mt-1 text-sm font-semibold">SETA: {evaluation.seta_recommendation_avg_distance_km} km</div>
              <div className="text-[10px] text-[#7a8c95]">Nearest-only: {evaluation.nearest_only_avg_distance_km} km</div>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-xs">
              <div className="eyebrow">Capacity avoidance</div>
              <div className="mt-1 text-sm font-semibold">{intPercent(evaluation.capacity_avoidance_rate)}% divert rate</div>
              <div className="text-[10px] text-[#7a8c95]">Diverted away from saturated ERs</div>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-xs">
              <div className="eyebrow">Critical queue latency</div>
              <div className="mt-1 text-sm font-semibold">{evaluation.priority_queue_critical_wait_min}m (SETA) vs {evaluation.fifo_critical_wait_min}m (FIFO)</div>
              <div className="text-[10px] text-[#7a8c95]">Avg scoring speed: {evaluation.avg_scoring_latency_ms} ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Experimental Synthetic Text Classifier Module */}
      <section className="surface mt-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-sm font-semibold">Optional AI Analytics: Synthetic Symptom Classifier</h2>
              <Badge tone="amber">Experimental</Badge>
            </div>
            <p className="mb-0 mt-1 text-xs text-[#819099]">
              Demonstrates explainable classification with uncertainty quantification. Non-clinical demonstration only.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-[#546a75] self-center">Try synthetic sample:</span>
          {[
            "Patient collapsed with sudden chest tightness, profuse cold sweating",
            "Severe motorcycle collision, compound leg fracture, controlled hemorrhage",
            "Acute asthma exacerbation, severe wheezing, unresponsive to bronchodilator",
            "Sudden right-sided hemiparesis and facial droop onset 20 min ago"
          ].map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleTestClassifier(sample)}
              className="rounded-lg border border-[#dbe4e7] bg-[#f8fbfa] px-2.5 py-1 text-[11px] text-[#345362] hover:bg-[#ebf4f1]"
            >
              Sample {idx + 1}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            placeholder="Type or select a synthetic symptom narrative to evaluate…"
            className="flex-1 rounded-lg border border-[#dbe4e7] px-3 py-2 text-xs outline-none focus:border-[#6eaa9c]"
          />
          <Button onClick={() => handleTestClassifier(nlpText)} disabled={!nlpText.trim() || nlpLoading}>
            {nlpLoading ? "Analyzing…" : "Analyze narrative"}
          </Button>
        </div>

        {nlpResult && (
          <div className="mt-4 rounded-xl border border-[#dfe7e9] bg-[#fdfefe] p-4 text-xs">
            <div className="grid gap-3 sm:grid-cols-4">
              <div><span className="eyebrow">Predicted category</span><div className="mt-1 font-semibold text-sm">{nlpResult.predicted_category}</div></div>
              <div><span className="eyebrow">Confidence</span><div className="mt-1 font-mono font-semibold">{intPercent(nlpResult.confidence)}%</div></div>
              <div><span className="eyebrow">Uncertainty</span><div className="mt-1 font-mono font-semibold">{intPercent(nlpResult.uncertainty)}%</div></div>
              <div><span className="eyebrow">Suggested priority</span><div className="mt-1"><StatusBadge status={nlpResult.suggested_priority} /></div></div>
            </div>
            <div className="mt-3 border-t border-[#edf0f2] pt-2 text-[11px] text-[#71848f]">
              <strong>Safety disclaimer:</strong> {nlpResult.disclaimer}
            </div>
          </div>
        )}
      </section>

      <div className="surface mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <h2 className="m-0 text-sm font-semibold">Weekly incident volume</h2>
            <p className="mb-0 mt-1 text-xs text-[#819099]">Database summary over time</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}><FileBarChart size={15} /> Print report</Button>
        </div>
        <div className="mt-5 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <CartesianGrid stroke="#edf1f2" vertical={false} />
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="cases" stroke="#438d80" strokeWidth={2.5} fill="#d8eee7" name="Total cases" />
              <Area type="monotone" dataKey="urgent" stroke="#d3a548" strokeWidth={2} fill="#fbf0d9" name="High acuity" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="surface p-5">
          <h2 className="m-0 text-sm font-semibold">Distribution by category</h2>
          {["Cardiac", "Trauma", "Medical", "Stroke", "Respiratory"].map((c) => {
            const count = emergencies.filter((e) => e.category === c).length;
            return (
              <div key={c} className="mt-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{c}</span>
                  <span className="font-mono">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f2]">
                  <div className="h-full rounded-full bg-[#74b6a7]" style={{ width: `${Math.max(count * 20, 4)}%` }} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="surface p-5">
          <h2 className="m-0 text-sm font-semibold">Hospital capacity snapshot</h2>
          {hospitals.map((h) => (
            <div key={h.id} className="mt-4 flex items-center justify-between border-b border-[#edf0f2] pb-3 text-xs">
              <div>
                {h.name}
                <div className="mt-1 text-[10px] text-[#829099]">{h.location}</div>
              </div>
              <div className="text-right">
                <strong>{h.bedsAvailable} beds</strong>
                <div className="mt-1 text-[10px] text-[#829099]">{h.icuAvailable} ICU · {h.status}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function intPercent(num: number): number {
  return Math.round(num * 100);
}

// ---------------------------------------------------------------------------
// Reports & Audit Trail Page
// ---------------------------------------------------------------------------
function Reports({ live = false, ops }: { live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const audit = live && ops ? ops.audit : demoData.audit;

  return (
    <>
      <PageTitle
        title="Audit trail & operational reports"
        subtitle="Review every coordination decision, ambulance assignment, triage update and capacity change."
        action={<Button onClick={() => window.print()} variant="outline"><FileBarChart size={15} /> Print audit report</Button>}
        demo={!live}
      />
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e8edef] p-5">
          <div>
            <h2 className="m-0 text-sm font-semibold">Database audit events</h2>
            <p className="mb-0 mt-1 text-xs text-[#829099]">Chronological system audit log</p>
          </div>
          <Badge tone="blue">{audit.length} events</Badge>
        </div>
        {audit.length ? (
          audit.map((a) => (
            <div key={a.id} className="grid gap-2 border-b border-[#edf0f2] px-5 py-4 last:border-0 sm:grid-cols-[1fr_1fr_1.4fr_1fr]">
              <div>
                <div className="text-xs font-semibold">{a.action}</div>
                <div className="mt-1 text-[10px] text-[#829099]">{a.actor}</div>
              </div>
              <div className="text-xs text-[#5f737d]">{a.target}</div>
              <div className="text-xs text-[#75858d]">{a.reason}</div>
              <div className="font-mono text-[10px] text-[#84929a]">{a.createdAt}</div>
            </div>
          ))
        ) : (
          <Empty title="No activity yet" body="System events appear here." />
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Administration Directory Page (Users, Hospitals, Ambulances)
// ---------------------------------------------------------------------------
function AdminPage({ kind, live = false, ops }: { kind: "users" | "hospitals" | "ambulances"; live?: boolean; ops?: ReturnType<typeof useLiveOperations> }) {
  const demoData = useDemoData();
  const title = kind === "users" ? "User access directory" : kind === "hospitals" ? "Hospital directory" : "Ambulance fleet directory";
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const rows = live && ops
    ? kind === "users" ? ops.users : kind === "hospitals" ? ops.hospitals : ops.ambulances
    : kind === "users" ? demoData.users : kind === "hospitals" ? demoData.hospitals : demoData.ambulances;

  return (
    <>
      <PageTitle
        title={title}
        subtitle={
          kind === "users"
            ? "Inspect provisioned user accounts and trusted roles."
            : kind === "hospitals"
            ? "Review facilities, capabilities, and capacity levels in the database."
            : "Review ambulance fleet vehicles and crew assignments."
        }
        demo={!live}
      />
      {notice && (
        <div role="status" className="mb-4 flex justify-between rounded-lg border border-[#dce7e8] bg-[#f2f7f6] p-3 text-xs text-[#466a65]">
          {notice}
          <button onClick={() => setNotice("")}><X size={14} /></button>
        </div>
      )}
      <div className="surface overflow-hidden">
        <div className="border-b border-[#e8edef] p-4">
          <label className="flex max-w-lg items-center gap-2 rounded-lg border border-[#e0e7ea] px-3 py-2 text-[#84929a]">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${kind}`}
              className="w-full bg-transparent text-xs outline-none"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#e8edef] text-[10px] uppercase tracking-wider text-[#809099]">
                {(kind === "users"
                  ? ["Name", "Email", "Role", "Status"]
                  : kind === "hospitals"
                  ? ["Facility", "Location", "Capabilities", "Capacity"]
                  : ["Unit", "Paramedic", "Location", "Status"]
                ).map((x) => (
                  <th key={x} className="px-4 py-3 font-semibold">{x}</th>
                ))}
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r: any) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))
                .map((r: any) => (
                  <tr key={r.id} className="border-b border-[#edf0f2] text-xs last:border-0">
                    {kind === "users" ? (
                      <>
                        <td className="px-4 py-4 font-semibold">{r.name}</td>
                        <td className="px-4 py-4 text-[#74858c]">{r.email}</td>
                        <td className="px-4 py-4 capitalize">{r.trustedRole || r.role || "Pending"}</td>
                        <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
                      </>
                    ) : kind === "hospitals" ? (
                      <>
                        <td className="px-4 py-4 font-semibold">{r.name}</td>
                        <td className="px-4 py-4 text-[#74858c]">{r.location}</td>
                        <td className="px-4 py-4">{r.capabilities?.join(", ")}</td>
                        <td className="px-4 py-4">{r.bedsAvailable} beds · {r.icuAvailable} ICU</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 font-mono font-semibold">{r.unit}</td>
                        <td className="px-4 py-4">{r.paramedicName}</td>
                        <td className="px-4 py-4 text-[#74858c]">{r.location}</td>
                        <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
                      </>
                    )}
                    <td className="px-4 py-4">
                      <Button variant="quiet" onClick={() => setNotice(`Viewing details for ${r.name || r.unit || r.id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Workspace Container: Mounts live pages connected to FastAPI
// ---------------------------------------------------------------------------
const routeRoles: Record<string, Role[]> = {
  "/dashboard": ["dispatcher", "hospital", "paramedic", "admin"],
  "/emergencies": ["dispatcher", "admin"],
  "/emergencies/new": ["dispatcher", "admin"],
  "/triage": ["dispatcher", "admin"],
  "/hospitals": ["dispatcher", "hospital", "admin"],
  "/dispatch": ["dispatcher", "paramedic", "admin"],
  "/hospital": ["hospital"],
  "/paramedic": ["paramedic"],
  "/notifications": ["dispatcher", "hospital", "paramedic", "admin"],
  "/analytics": ["dispatcher", "admin"],
  "/reports": ["dispatcher", "admin"],
  "/admin/users": ["admin"],
  "/admin/hospitals": ["admin"],
  "/admin/ambulances": ["admin"]
};

function Workspace({ path }: { path: string }) {
  const { role, currentUser } = useAuth();
  const effectiveRole = role || "dispatcher";
  const ops = useLiveOperations();

  // If loading live database state on initial mount
  if (ops.loading && ops.emergencies.length === 0) {
    return (
      <AppFrame role={effectiveRole} title={path === "/dashboard" ? "Overview" : path.replace("/", "").replaceAll("/", " / ")} demo={false}>
        <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
          <RefreshCw className="animate-spin text-[#3a8174]" size={28} />
          <div className="text-sm font-semibold text-[#27404f]">Connecting to SETA-HRC FastAPI backend…</div>
          <p className="text-xs text-[#809199]">Loading live emergency coordination state from database.</p>
        </div>
      </AppFrame>
    );
  }

  const allowedRoles = routeRoles[path];
  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  const pageComponent =
    path === "/dashboard" ? (
      <Dashboard live ops={ops} />
    ) : path === "/emergencies" ? (
      <Emergencies live ops={ops} />
    ) : path === "/emergencies/new" ? (
      <NewEmergency live ops={ops} />
    ) : path === "/triage" ? (
      <Emergencies live onlyTriage ops={ops} />
    ) : path === "/hospitals" ? (
      <Hospitals live ops={ops} />
    ) : path === "/dispatch" ? (
      <Dispatch live ops={ops} />
    ) : path === "/hospital" ? (
      <HospitalDesk live ops={ops} />
    ) : path === "/paramedic" ? (
      <Paramedic live ops={ops} />
    ) : path === "/notifications" ? (
      <Notifications live ops={ops} />
    ) : path === "/analytics" ? (
      <Analytics live ops={ops} />
    ) : path === "/reports" ? (
      <Reports live ops={ops} />
    ) : path === "/admin/users" ? (
      <AdminPage live kind="users" ops={ops} />
    ) : path === "/admin/hospitals" ? (
      <AdminPage live kind="hospitals" ops={ops} />
    ) : (
      <AdminPage live kind="ambulances" ops={ops} />
    );

  return (
    <AppFrame
      role={effectiveRole}
      title={path === "/dashboard" ? "Overview" : path.replace("/", "").replaceAll("/", " / ")}
      demo={false}
    >
      {pageComponent}
    </AppFrame>
  );
}

// ---------------------------------------------------------------------------
// Demo Route Container (In-Memory Sample Data)
// ---------------------------------------------------------------------------
function DemoRoute({ path }: { path: string }) {
  const page =
    path === "/dashboard" ? (
      <Dashboard />
    ) : path === "/emergencies" ? (
      <Emergencies />
    ) : path === "/emergencies/new" ? (
      <NewEmergency />
    ) : path === "/triage" ? (
      <Emergencies onlyTriage />
    ) : path === "/hospitals" ? (
      <Hospitals />
    ) : path === "/dispatch" ? (
      <Dispatch />
    ) : path === "/hospital" ? (
      <HospitalDesk />
    ) : path === "/paramedic" ? (
      <Paramedic />
    ) : path === "/notifications" ? (
      <Notifications />
    ) : path === "/analytics" ? (
      <Analytics />
    ) : path === "/reports" ? (
      <Reports />
    ) : path === "/admin/users" ? (
      <AdminPage kind="users" />
    ) : path === "/admin/hospitals" ? (
      <AdminPage kind="hospitals" />
    ) : (
      <AdminPage kind="ambulances" />
    );

  return (
    <AppFrame role="admin" demo title={path.replace("/", "").replaceAll("/", " / ")}>
      {page}
    </AppFrame>
  );
}

// ---------------------------------------------------------------------------
// Authentication & Quick-Login Page
// ---------------------------------------------------------------------------
function AuthPages() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("dispatcher");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAuth = async (ev: FormEvent) => {
    ev.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) {
        await authService.register(name, email, password, role);
      } else {
        await login(email, password);
      }
      nav("/dashboard");
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setError("");
    setBusy(true);
    try {
      await login(demoEmail, demoPass);
      nav("/dashboard");
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f2f6f6] p-4">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex justify-center"><Brand /></div>
        <div className="surface p-6 shadow-xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-[#1f3442]">
              {isRegister ? "Request SETA-HRC access" : "Sign in to SETA-HRC"}
            </h1>
            <p className="mt-1 text-xs text-[#71828c]">
              Smart Emergency Triage, Ambulance & Hospital Resource Coordination
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-[#3b515d]">Full Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="mt-1 w-full rounded-lg border border-[#dbe4e7] px-3 py-2 text-sm outline-none focus:border-[#6eaa9c]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#3b515d]">Email address</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@seta-hrc.org"
                className="mt-1 w-full rounded-lg border border-[#dbe4e7] px-3 py-2 text-sm outline-none focus:border-[#6eaa9c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3b515d]">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-[#dbe4e7] px-3 py-2 text-sm outline-none focus:border-[#6eaa9c]"
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-[#3b515d]">Requested operational role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#dbe4e7] bg-white px-3 py-2 text-sm"
                >
                  <option value="dispatcher">Dispatcher</option>
                  <option value="hospital">Hospital Receiving Team</option>
                  <option value="paramedic">Paramedic Crew</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-[#f0c7ca] bg-[#fff2f2] p-3 text-xs text-[#a32331]">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Authenticating…" : isRegister ? "Create account" : "Sign in to workspace"}
            </Button>

            <div className="text-center text-xs text-[#71828c]">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError("");
                }}
                className="font-semibold text-[#276d60] hover:underline"
              >
                {isRegister ? "Already have an account? Sign in" : "Need an account? Register here"}
              </button>
            </div>
          </form>

          {/* Quick demonstration login pills for easy evaluation */}
          <div className="mt-8 border-t border-[#edf0f2] pt-5">
            <div className="mb-3 text-center eyebrow !text-[#788a93]">One-click demonstration roles</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => quickLogin("asha.nair@seta-hrc.org", "Dispatcher@123")}
                className="flex items-center gap-2 rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] p-2 text-left hover:bg-[#ebf4f1]"
              >
                <ClipboardList size={14} className="text-[#3b7e72]" />
                <div>
                  <div className="font-semibold text-[#223642]">Dispatcher</div>
                  <div className="text-[10px] text-[#788a93]">Asha Nair</div>
                </div>
              </button>

              <button
                onClick={() => quickLogin("rohan.shetty@seta-hrc.org", "Hospital@123")}
                className="flex items-center gap-2 rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] p-2 text-left hover:bg-[#ebf4f1]"
              >
                <Cross size={14} className="text-[#3b7e72]" />
                <div>
                  <div className="font-semibold text-[#223642]">Hospital desk</div>
                  <div className="text-[10px] text-[#788a93]">Dr. Rohan Shetty</div>
                </div>
              </button>

              <button
                onClick={() => quickLogin("priya.menon@seta-hrc.org", "Paramedic@123")}
                className="flex items-center gap-2 rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] p-2 text-left hover:bg-[#ebf4f1]"
              >
                <Ambulance size={14} className="text-[#3b7e72]" />
                <div>
                  <div className="font-semibold text-[#223642]">Paramedic</div>
                  <div className="text-[10px] text-[#788a93]">Priya Menon</div>
                </div>
              </button>

              <button
                onClick={() => quickLogin("ops@seta-hrc.org", "Admin@123")}
                className="flex items-center gap-2 rounded-lg border border-[#dbe4e7] bg-[#fbfcfc] p-2 text-left hover:bg-[#ebf4f1]"
              >
                <Settings size={14} className="text-[#3b7e72]" />
                <div>
                  <div className="font-semibold text-[#223642]">Admin</div>
                  <div className="text-[10px] text-[#788a93]">Operations Admin</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------
function Home() {
  const { role, currentUser } = useAuth();
  if (currentUser && role) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-[100dvh] bg-[#f7f9f9] text-[#1b2a3a]">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-5">
        <Brand />
        <div className="flex items-center gap-3">
          <Link to="/sign-in" className="px-3 py-2 text-sm font-semibold text-[#405967]">Sign in</Link>
          <Button to="/demo" variant="outline">Open demo workspace <ArrowRight size={15} /></Button>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.02fr_.98fr] lg:pb-28 lg:pt-20">
          <div className="fade-up relative z-10">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.13em] text-[#4a8076]">
              <span className="h-px w-7 bg-[#78c8b7]" /> One coordinated emergency network
            </div>
            <h1 className="m-0 max-w-[640px] font-serif text-[clamp(46px,6vw,78px)] font-medium leading-[.99] tracking-[-.055em]">
              Every minute.<br />
              <span className="text-[#527c78]">Better connected.</span>
            </h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-7 text-[#63747d]">
              SETA-HRC connects dispatchers, ambulance crews and receiving hospitals in real time — from initial intake to confirmed patient handover.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/sign-in">Sign in to SETA-HRC <ArrowRight size={16} /></Button>
              <Button to="/demo" variant="outline">Explore sample workspace</Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#6c7d85]">
              <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#4a8b7e]" />Role-based access</span>
              <span className="flex items-center gap-2"><Clock3 size={15} className="text-[#4a8b7e]" />Real-time WebSocket coordination</span>
              <span className="flex items-center gap-2"><MapPin size={15} className="text-[#4a8b7e]" />Hospital resource visibility</span>
            </div>
          </div>

          <div className="relative fade-up" style={{ animationDelay: "120ms" }}>
            <div className="absolute -right-5 -top-5 h-48 w-48 rounded-full bg-[#dceee9] blur-3xl" />
            <div className="relative overflow-hidden rounded-[24px] border border-[#dbe6e8] bg-[#e9f0ef] p-4 shadow-[0_24px_80px_#1a3a4b17]">
              <div className="mb-3 flex items-center justify-between px-2">
                <div>
                  <div className="eyebrow">Response coordination flow</div>
                  <div className="mt-1 text-sm font-semibold">Central Bengaluru · live operational telemetry</div>
                </div>
                <LiveTag />
              </div>
              <div className="relative h-[300px] overflow-hidden rounded-[16px] bg-[#dce8e6] md:h-[355px]">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 370" aria-hidden="true">
                  <path d="M89 285 C180 244, 206 250, 260 206 S386 180, 476 115" fill="none" stroke="#469886" strokeWidth="4" strokeDasharray="8 7" />
                  <path d="M130 85 C176 108, 202 133, 260 206" fill="none" stroke="#2b5367" strokeWidth="3" strokeDasharray="6 7" />
                </svg>
                {[
                  { x: "18%", y: "70%", t: "A-02" },
                  { x: "43%", y: "52%", t: "SE" },
                  { x: "76%", y: "29%", t: "H" }
                ].map((p) => (
                  <div key={p.t + p.x} className="absolute flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#1d3548] text-[9px] font-bold text-white shadow-lg" style={{ left: p.x, top: p.y }}>
                    {p.t}
                  </div>
                ))}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/70 bg-white/90 p-3 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff0f0] text-[#b92736]"><Siren size={18} /></span>
                    <div>
                      <div className="text-xs font-semibold">Live Priority Emergency Response</div>
                      <div className="mt-0.5 text-[10px] text-[#70818a]">Connected to Python FastAPI Backend & WebSocket Stream</div>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-[#55717c]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e3e9e8] bg-white px-6 py-14">
          <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-3">
            <div>
              <span className="eyebrow">01 / Triage</span>
              <h2 className="mt-3 font-serif text-[26px] font-medium">A clearer first decision.</h2>
              <p className="text-sm leading-6 text-[#70818a]">Structured intake and explainable priority cues help control rooms focus on what needs attention now.</p>
            </div>
            <div>
              <span className="eyebrow">02 / Dispatch</span>
              <h2 className="mt-3 font-serif text-[26px] font-medium">The right crew, sooner.</h2>
              <p className="text-sm leading-6 text-[#70818a]">See unit availability, case context and route status in one shared operational control view.</p>
            </div>
            <div>
              <span className="eyebrow">03 / Handover</span>
              <h2 className="mt-3 font-serif text-[26px] font-medium">Care stays connected.</h2>
              <p className="text-sm leading-6 text-[#70818a]">Match needs to hospital capabilities, reserve beds transactionally, and keep every update synchronized.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e3e9e8] px-6 py-6 text-center text-xs text-[#7b8b92]">
        SETA-HRC · Smart Emergency Triage, Ambulance & Hospital Resource Coordination System
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protected Route Gate
// ---------------------------------------------------------------------------
function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { currentUser, role } = useAuth();
  if (!currentUser) return <Navigate to="/sign-in" replace />;
  if (!role) return <Navigate to="/sign-in" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Route Mapping & Application Root
// ---------------------------------------------------------------------------
function DemoParam() {
  const { page = "dashboard", "*": rest } = useParams();
  const path = page === "admin" ? `/admin/${rest || "users"}` : page === "emergencies" && rest === "new" ? "/emergencies/new" : `/${page}`;
  const allowed = [
    "/dashboard", "/emergencies", "/emergencies/new", "/triage", "/hospitals",
    "/dispatch", "/hospital", "/paramedic", "/notifications", "/analytics",
    "/reports", "/admin/users", "/admin/hospitals", "/admin/ambulances"
  ];
  return allowed.includes(path) ? <DemoRoute path={path} /> : <Navigate to="/demo/dashboard" replace />;
}

function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f4f7f8] p-5 text-center">
      <div>
        <div className="eyebrow">SETA-HRC · 404</div>
        <h1 className="mt-3 font-serif text-5xl">Page not found</h1>
        <p className="text-sm text-[#74858c]">This destination is not part of the response workspace.</p>
        <Button to="/">Return to home</Button>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basePath || "/"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in/*" element={<AuthPages />} />
          <Route path="/sign-up/*" element={<AuthPages />} />
          <Route path="/demo" element={<Navigate to="/demo/dashboard" replace />} />
          <Route path="/demo/:page/*" element={<DemoParam />} />

          {/* Authenticated Live Operational Routes connected to FastAPI */}
          <Route path="/dashboard" element={<Protected><Workspace path="/dashboard" /></Protected>} />
          <Route path="/emergencies" element={<Protected><Workspace path="/emergencies" /></Protected>} />
          <Route path="/emergencies/new" element={<Protected><Workspace path="/emergencies/new" /></Protected>} />
          <Route path="/triage" element={<Protected><Workspace path="/triage" /></Protected>} />
          <Route path="/hospitals" element={<Protected><Workspace path="/hospitals" /></Protected>} />
          <Route path="/dispatch" element={<Protected><Workspace path="/dispatch" /></Protected>} />
          <Route path="/hospital" element={<Protected><Workspace path="/hospital" /></Protected>} />
          <Route path="/paramedic" element={<Protected><Workspace path="/paramedic" /></Protected>} />
          <Route path="/notifications" element={<Protected><Workspace path="/notifications" /></Protected>} />
          <Route path="/analytics" element={<Protected><Workspace path="/analytics" /></Protected>} />
          <Route path="/reports" element={<Protected><Workspace path="/reports" /></Protected>} />
          <Route path="/admin/users" element={<Protected><Workspace path="/admin/users" /></Protected>} />
          <Route path="/admin/hospitals" element={<Protected><Workspace path="/admin/hospitals" /></Protected>} />
          <Route path="/admin/ambulances" element={<Protected><Workspace path="/admin/ambulances" /></Protected>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
