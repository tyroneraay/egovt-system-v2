import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FileText, Users, Shield, Clock, CheckCircle, XCircle,
  CreditCard, Bell, Search, LogOut, Eye, Download,
  ChevronRight, Upload, AlertCircle, Activity,
  UserCheck, UserX, Mail, Home, Settings, X, Plus,
  ArrowRight, ChevronDown, Zap, Hash, ArrowUpRight,
  MoreVertical, Image, Paperclip, Send, RefreshCw,
  Layers, TrendingUp, Filter, Copy, Check, Edit, Lock, Save
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   CONSTANTS & CONFIG
   ═══════════════════════════════════════════════════════ */
const STATUS = {
  pending:          { label: "Pending",          color: "#D97706", bg: "#FEF3C7", icon: Clock },
  under_review:     { label: "Under Review",     color: "#2563EB", bg: "#DBEAFE", icon: Eye },
  awaiting_payment: { label: "Awaiting Payment", color: "#7C3AED", bg: "#EDE9FE", icon: CreditCard },
  paid:             { label: "Paid",             color: "#0891B2", bg: "#CFFAFE", icon: Check },
  processing:       { label: "Processing",       color: "#EA580C", bg: "#FFF7ED", icon: RefreshCw },
  ready:            { label: "Ready for Release", color: "#059669", bg: "#D1FAE5", icon: CheckCircle },
  released:         { label: "Released",         color: "#047857", bg: "#A7F3D0", icon: Download },
  rejected:         { label: "Rejected",         color: "#DC2626", bg: "#FEE2E2", icon: XCircle },
};

const TRANSITIONS = {
  pending:          ["under_review", "rejected"],
  under_review:     ["awaiting_payment", "rejected"],
  awaiting_payment: [],
  paid:             ["processing"],
  processing:       ["ready"],
  ready:            ["released"],
  released:         [],
  rejected:         [],
};

const DOC_TYPES = [
  { id: 1, name: "Barangay Clearance",        fee: 100, desc: "General-purpose clearance" },
  { id: 2, name: "Certificate of Residency",  fee: 75,  desc: "Proof of residence" },
  { id: 3, name: "Certificate of Indigency",  fee: 0,   desc: "For financial assistance" },
  { id: 4, name: "Business Permit Clearance",  fee: 200, desc: "Business operation clearance" },
  { id: 5, name: "Barangay ID",                fee: 50,  desc: "Official barangay identification" },
  { id: 6, name: "Certificate of Good Moral",  fee: 50,  desc: "Character reference" },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ago = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const peso = (n) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

/* ═══════════════════════════════════════════════════════
   SEED DATA
   ═══════════════════════════════════════════════════════ */
const mkDate = (daysAgo, hoursAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
};

const SEED_USERS = [
  { id: "u_admin", email: "admin@brgy-maharlika.gov.ph", role: "admin", name: "Kap. Roberto Garcia", verified: true, avatar: "RG", password: "admin123" },
  { id: "u_staff1", email: "maria.santos@brgy-maharlika.gov.ph", role: "staff", name: "Maria Santos", verified: true, avatar: "MS", position: "Senior Clerk", active: true, password: "staff123" },
  { id: "u_staff2", email: "pedro.reyes@brgy-maharlika.gov.ph", role: "staff", name: "Pedro Reyes", verified: true, avatar: "PR", position: "Document Processor", active: true, password: "staff123" },
  { id: "u_res1", email: "juan.delacruz@gmail.com", role: "resident", name: "Juan Dela Cruz", verified: true, avatar: "JD", phone: "0917-123-4567", address: "Block 5, Lot 12, Rizal St., Brgy. Maharlika", civil_status: "Single", dob: "1995-06-15" },
  { id: "u_res2", email: "ana.reyes@gmail.com", role: "resident", name: "Ana Marie Reyes", verified: true, avatar: "AR", phone: "0918-765-4321", address: "Unit 3, Mabini Compound, Brgy. Maharlika", civil_status: "Married", dob: "1988-11-22" },
  { id: "u_res3", email: "carlo.mendoza@gmail.com", role: "resident", name: "Carlo Mendoza", verified: false, avatar: "CM", phone: "0919-555-7890", address: "456 Bonifacio Ave., Brgy. Maharlika", civil_status: "Single", dob: "2000-03-08" },
];

const SEED_REQUESTS = [
  { id: "r_1", residentId: "u_res1", residentName: "Juan Dela Cruz", docTypeId: 1, docName: "Barangay Clearance", status: "released", purpose: "Employment at SM Corporation", staffId: "u_staff1", staffName: "Maria Santos", fee: 100, payMethod: "gcash", payStatus: "verified", createdAt: mkDate(15), updatedAt: mkDate(2), releasedAt: mkDate(2) },
  { id: "r_2", residentId: "u_res2", residentName: "Ana Marie Reyes", docTypeId: 2, docName: "Certificate of Residency", status: "awaiting_payment", purpose: "Child school enrollment — Grade 1", staffId: "u_staff1", staffName: "Maria Santos", fee: 75, createdAt: mkDate(3), updatedAt: mkDate(1) },
  { id: "r_3", residentId: "u_res1", residentName: "Juan Dela Cruz", docTypeId: 3, docName: "Certificate of Indigency", status: "pending", purpose: "Medical assistance application — PGH", fee: 0, createdAt: mkDate(0, 4), updatedAt: mkDate(0, 4) },
  { id: "r_4", residentId: "u_res2", residentName: "Ana Marie Reyes", docTypeId: 4, docName: "Business Permit Clearance", status: "processing", purpose: "Sari-sari store — Reyes General Merchandise", staffId: "u_staff2", staffName: "Pedro Reyes", fee: 200, payMethod: "walk_in", payStatus: "verified", createdAt: mkDate(5), updatedAt: mkDate(0, 6) },
  { id: "r_5", residentId: "u_res1", residentName: "Juan Dela Cruz", docTypeId: 6, docName: "Certificate of Good Moral", status: "under_review", purpose: "Scholarship application — DOST", staffId: "u_staff2", staffName: "Pedro Reyes", fee: 50, createdAt: mkDate(1), updatedAt: mkDate(0, 8) },
];

const SEED_LOGS = [
  { id: "l1", actor: "Maria Santos", action: "Approved request", detail: "Barangay Clearance — Juan Dela Cruz", at: mkDate(12) },
  { id: "l2", actor: "Maria Santos", action: "Verified payment", detail: "GCash — ₱100 — Juan Dela Cruz", at: mkDate(10) },
  { id: "l3", actor: "Pedro Reyes", action: "Released document", detail: "Barangay Clearance — Juan Dela Cruz", at: mkDate(2) },
  { id: "l4", actor: "Maria Santos", action: "Approved request", detail: "Certificate of Residency — Ana Marie Reyes → Awaiting Payment", at: mkDate(1) },
  { id: "l5", actor: "Pedro Reyes", action: "Started processing", detail: "Business Permit Clearance — Ana Marie Reyes", at: mkDate(0, 6) },
];

const SEED_NOTIFS = [
  { id: "n1", userId: "u_res1", title: "Document Released", body: "Your Barangay Clearance has been released. You may download or pick it up.", read: true, at: mkDate(2) },
  { id: "n2", userId: "u_res2", title: "Payment Required", body: "Your Certificate of Residency is approved. Please submit payment of ₱75.", read: false, at: mkDate(1) },
  { id: "n3", userId: "u_staff1", title: "New Request", body: "Juan Dela Cruz submitted a request for Certificate of Indigency.", read: false, at: mkDate(0, 4) },
  { id: "n4", userId: "u_staff2", title: "New Request", body: "Juan Dela Cruz submitted a request for Certificate of Indigency.", read: false, at: mkDate(0, 4) },
];

/* ═══════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════ */
const Badge = ({ status }) => {
  const s = STATUS[status]; if (!s) return null;
  return <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3px", display: "inline-flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap" }}><s.icon size={11}/>{s.label}</span>;
};

const Avatar = ({ initials, size = 36, bg = "#2D6A4F" }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.3, background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, letterSpacing: "0.5px", flexShrink: 0 }}>{initials}</div>
);

const Pill = ({ children, active, onClick, count }) => (
  <button onClick={onClick} style={{
    padding: "7px 14px", borderRadius: "8px", border: active ? "1.5px solid #2D6A4F" : "1.5px solid #E8E4DF",
    background: active ? "#2D6A4F" : "#fff", color: active ? "#fff" : "#6B7280",
    fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", transition: "all 0.15s"
  }}>
    {children}
    {count !== undefined && <span style={{ background: active ? "rgba(255,255,255,0.25)" : "#F3F4F6", color: active ? "#fff" : "#9CA3AF", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>{count}</span>}
  </button>
);

const Card = ({ children, style: sx, onClick, hover }) => (
  <div onClick={onClick} style={{
    background: "#fff", borderRadius: "14px", border: "1px solid #E5E7EB",
    transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...sx
  }}>{children}</div>
);

const Stat = ({ icon: Icon, label, value, sub, accent = "#2D6A4F" }) => (
  <Card style={{ padding: "20px 22px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
      <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: accent + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} color={accent}/></div>
    </div>
    <div style={{ fontSize: "28px", fontWeight: 800, color: "#111827", letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "6px" }}>{sub}</div>}
  </Card>
);

const Btn = ({ children, onClick, v = "primary", s = "md", disabled, full, style: sx }) => {
  const variants = {
    primary:   { bg: "#2D6A4F", color: "#fff", border: "none" },
    secondary: { bg: "#F9FAFB", color: "#374151", border: "1px solid #E5E7EB" },
    danger:    { bg: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" },
    success:   { bg: "#F0FDF4", color: "#059669", border: "1px solid #BBF7D0" },
    ghost:     { bg: "transparent", color: "#6B7280", border: "none" },
    accent:    { bg: "#7C3AED", color: "#fff", border: "none" },
  };
  const sizes = { xs: { p: "4px 10px", f: "11px" }, sm: { p: "7px 14px", f: "12px" }, md: { p: "10px 20px", f: "13px" }, lg: { p: "13px 28px", f: "14px" } };
  const vr = variants[v]; const sz = sizes[s];
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      background: vr.bg, color: vr.color, border: vr.border, padding: sz.p, fontSize: sz.f,
      borderRadius: "8px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "inherit",
      opacity: disabled ? 0.45 : 1, transition: "all 0.15s", width: full ? "100%" : "auto",
      justifyContent: full ? "center" : "flex-start", ...sx
    }}>{children}</button>
  );
};

const Field = ({ label, children, hint, required }) => (
  <div style={{ marginBottom: "18px" }}>
    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "6px", letterSpacing: "0.2px" }}>
      {label} {required && <span style={{ color: "#DC2626" }}>*</span>}
    </label>
    {children}
    {hint && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "4px" }}>{hint}</p>}
  </div>
);

const Input = ({ value, onChange, placeholder, type = "text", disabled }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{ width: "100%", padding: "9px 13px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "13px", color: "#111827", background: disabled ? "#F9FAFB" : "#fff", outline: "none", fontFamily: "inherit", transition: "border 0.15s" }} />
);

const Select = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", padding: "9px 13px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "13px", color: value ? "#111827" : "#9CA3AF", background: "#fff", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
    <option value="">{placeholder || "Select..."}</option>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: "100%", padding: "9px 13px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#fff", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }} />
);

const Modal = ({ title, subtitle, children, onClose, width = 480 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, backdropFilter: "blur(3px)", padding: "20px" }} onClick={onClose}>
    <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: width, maxHeight: "88vh", overflow: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>{title}</h3>
          {subtitle && <p style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} color="#6B7280"/></button>
      </div>
      <div style={{ padding: "20px 28px 28px" }}>{children}</div>
    </div>
  </div>
);

const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const cfg = { success: { bg: "#F0FDF4", border: "#BBF7D0", color: "#065F46", icon: CheckCircle }, error: { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B", icon: XCircle }, info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E40AF", icon: Bell } };
  const c = cfg[type] || cfg.info;
  return (
    <div style={{ position: "fixed", top: "20px", right: "20px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px", zIndex: 9999, boxShadow: "0 10px 40px rgba(0,0,0,0.1)", animation: "toastIn 0.3s ease", maxWidth: "400px" }}>
      <c.icon size={18} color={c.color}/><span style={{ fontSize: "13px", color: c.color, fontWeight: 500 }}>{message}</span>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, desc, action }) => (
  <div style={{ textAlign: "center", padding: "60px 24px" }}>
    <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Icon size={24} color="#9CA3AF"/></div>
    <p style={{ fontSize: "15px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>{title}</p>
    <p style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "16px" }}>{desc}</p>
    {action}
  </div>
);

/* ═══════════════════════════════════════════════════════
   TIMELINE — shows the request lifecycle visually
   ═══════════════════════════════════════════════════════ */
const StatusTimeline = ({ currentStatus }) => {
  const flow = ["pending", "under_review", "awaiting_payment", "paid", "processing", "ready", "released"];
  const isRejected = currentStatus === "rejected";
  const currentIdx = flow.indexOf(currentStatus);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", overflowX: "auto", padding: "8px 0" }}>
      {flow.map((s, i) => {
        const cfg = STATUS[s];
        const done = i <= currentIdx && !isRejected;
        const active = s === currentStatus && !isRejected;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "64px" }}>
              <div style={{
                width: active ? "28px" : "22px", height: active ? "28px" : "22px", borderRadius: "50%",
                background: done ? cfg.color : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s", boxShadow: active ? `0 0 0 4px ${cfg.color}25` : "none"
              }}>
                {done ? <Check size={active ? 14 : 11} color="#fff" strokeWidth={3}/> : <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#D1D5DB" }}/>}
              </div>
              <span style={{ fontSize: "9px", fontWeight: 600, color: done ? cfg.color : "#9CA3AF", textAlign: "center", lineHeight: 1.2, maxWidth: "68px" }}>{cfg.label}</span>
            </div>
            {i < flow.length - 1 && (
              <div style={{ width: "20px", height: "2px", background: i < currentIdx && !isRejected ? STATUS[flow[i+1]]?.color || "#D1D5DB" : "#E5E7EB", marginBottom: "18px", flexShrink: 0 }}/>
            )}
          </div>
        );
      })}
      {isRejected && (
        <div style={{ display: "flex", alignItems: "center", marginLeft: "8px", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px #DC262625" }}>
              <X size={14} color="#fff" strokeWidth={3}/>
            </div>
            <span style={{ fontSize: "9px", fontWeight: 600, color: "#DC2626" }}>Rejected</span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   REQUEST DETAIL PANEL
   ═══════════════════════════════════════════════════════ */
const RequestDetail = ({ req, user, onClose, onAction, onPayment, onEdit }) => {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [payMethod, setPayMethod] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPurpose, setEditPurpose] = useState(req.purpose);
  const [editDocTypeId, setEditDocTypeId] = useState(req.docTypeId.toString());
  const [editResidentName, setEditResidentName] = useState(req.residentName);
  const isStaffOrAdmin = user.role === "staff" || user.role === "admin";
  const isResident = user.role === "resident";
  const nextStatuses = TRANSITIONS[req.status] || [];
  const canEdit = isStaffOrAdmin && (req.status === "under_review" || req.status === "processing");

  const handleSaveEdit = () => {
    const dt = DOC_TYPES.find(d => d.id === parseInt(editDocTypeId));
    onEdit(req.id, {
      purpose: editPurpose.trim(),
      docTypeId: dt.id,
      docName: dt.name,
      fee: dt.fee,
      residentName: editResidentName.trim(),
    });
    setEditing(false);
  };

  return (
    <Modal title={editing ? "Edit Request" : req.docName} subtitle={`Request #${req.id.toUpperCase()}`} onClose={onClose} width={560}>
      {/* Timeline */}
      <div style={{ marginBottom: "24px", padding: "16px", background: "#F9FAFB", borderRadius: "12px" }}>
        <StatusTimeline currentStatus={req.status}/>
      </div>

      {/* Edit Mode */}
      {editing ? (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ padding: "10px 14px", background: "#EFF6FF", borderRadius: "8px", border: "1px solid #BFDBFE", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Edit size={14} color="#2563EB"/>
            <span style={{ fontSize: "12px", color: "#1E40AF", fontWeight: 600 }}>Editing request details — changes will be logged</span>
          </div>
          <Field label="Resident Name">
            <Input value={editResidentName} onChange={setEditResidentName}/>
          </Field>
          <Field label="Document Type" required>
            <Select value={editDocTypeId} onChange={setEditDocTypeId}
              options={DOC_TYPES.map(d => ({ value: d.id.toString(), label: `${d.name} — ${d.fee > 0 ? peso(d.fee) : "FREE"}` }))}/>
          </Field>
          <Field label="Purpose" required>
            <Textarea value={editPurpose} onChange={setEditPurpose} rows={3}/>
          </Field>
          {parseInt(editDocTypeId) !== req.docTypeId && (() => {
            const newDoc = DOC_TYPES.find(d => d.id === parseInt(editDocTypeId));
            const oldDoc = DOC_TYPES.find(d => d.id === req.docTypeId);
            if (newDoc && oldDoc && newDoc.fee !== oldDoc.fee) {
              return (
                <div style={{ padding: "10px 14px", background: "#FFFBEB", borderRadius: "8px", border: "1px solid #FDE68A", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={14} color="#D97706"/>
                  <span style={{ fontSize: "12px", color: "#92400E" }}>Fee will change from {peso(oldDoc.fee)} → {peso(newDoc.fee)}</span>
                </div>
              );
            }
            return null;
          })()}
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn v="primary" s="md" disabled={!editPurpose.trim() || !editDocTypeId} onClick={handleSaveEdit}>
              <Save size={14}/> Save Changes
            </Btn>
            <Btn v="secondary" s="md" onClick={() => { setEditing(false); setEditPurpose(req.purpose); setEditDocTypeId(req.docTypeId.toString()); setEditResidentName(req.residentName); }}>
              Cancel
            </Btn>
          </div>
        </div>
      ) : (
        <>
          {/* Info Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "24px" }}>
            {[
              { l: "Requested By", v: req.residentName },
              { l: "Document Type", v: req.docName },
              { l: "Purpose", v: req.purpose },
              { l: "Fee", v: req.fee > 0 ? peso(req.fee) : "FREE" },
              { l: "Submitted", v: fmtDate(req.createdAt) },
              { l: "Last Updated", v: fmtTime(req.updatedAt) },
              ...(req.staffName ? [{ l: "Assigned Staff", v: req.staffName }] : []),
              ...(req.payMethod ? [{ l: "Payment Method", v: req.payMethod === "gcash" ? "GCash" : "Walk-in" }] : []),
              ...(req.payStatus ? [{ l: "Payment Status", v: req.payStatus.charAt(0).toUpperCase() + req.payStatus.slice(1) }] : []),
              ...(req.rejectionReason ? [{ l: "Rejection Reason", v: req.rejectionReason }] : []),
            ].map((item, i) => (
              <div key={i} style={{ gridColumn: item.l === "Purpose" || item.l === "Rejection Reason" ? "1 / -1" : "auto" }}>
                <div style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "3px" }}>{item.l}</div>
                <div style={{ fontSize: "13px", color: "#111827", fontWeight: 500 }}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Edit button for under_review and processing */}
          {canEdit && (
            <div style={{ marginBottom: "16px" }}>
              <Btn v="secondary" s="sm" onClick={() => setEditing(true)}>
                <Edit size={14}/> Edit Request Details
              </Btn>
            </div>
          )}
        </>
      )}

      {/* STAFF ACTIONS */}
      {!editing && isStaffOrAdmin && nextStatuses.length > 0 && !showReject && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          {nextStatuses.filter(s => s !== "rejected").map(ns => {
            // If fee is 0 and transition is to awaiting_payment, show label as "Skip to Paid (Free)"
            const isFreeSkip = ns === "awaiting_payment" && req.fee === 0;
            return (
              <Btn key={ns} v="primary" s="md" onClick={() => onAction(req.id, ns)}>
                <ChevronRight size={14}/> {isFreeSkip ? "Approve (Free → Paid)" : `Move to ${STATUS[ns].label}`}
              </Btn>
            );
          })}
          {nextStatuses.includes("rejected") && (
            <Btn v="danger" s="md" onClick={() => setShowReject(true)}>
              <XCircle size={14}/> Reject
            </Btn>
          )}
        </div>
      )}

      {/* Payment verification for staff when payment submitted */}
      {!editing && isStaffOrAdmin && req.status === "awaiting_payment" && req.payStatus === "submitted" && (
        <div style={{ padding: "16px", background: "#FFFBEB", borderRadius: "10px", border: "1px solid #FDE68A", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <CreditCard size={16} color="#D97706"/>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#92400E" }}>Payment proof submitted via {req.payMethod === "gcash" ? "GCash" : "Walk-in"}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn v="success" s="sm" onClick={() => onAction(req.id, "paid", { payStatus: "verified" })}>
              <CheckCircle size={14}/> Verify Payment
            </Btn>
            <Btn v="danger" s="sm" onClick={() => onAction(req.id, "awaiting_payment", { payStatus: "rejected_pay" })}>
              <XCircle size={14}/> Reject Payment
            </Btn>
          </div>
        </div>
      )}

      {/* Reject Form */}
      {showReject && (
        <div style={{ padding: "16px", background: "#FEF2F2", borderRadius: "10px", border: "1px solid #FECACA", marginBottom: "16px" }}>
          <Field label="Reason for Rejection" required>
            <Textarea value={rejectReason} onChange={setRejectReason} placeholder="Provide a clear reason for rejection..." rows={3}/>
          </Field>
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn v="danger" s="sm" disabled={!rejectReason.trim()} onClick={() => { onAction(req.id, "rejected", { rejectionReason: rejectReason }); setShowReject(false); }}>
              Confirm Rejection
            </Btn>
            <Btn v="ghost" s="sm" onClick={() => setShowReject(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* RESIDENT ACTIONS — Pay */}
      {isResident && req.status === "awaiting_payment" && !req.payStatus && !showPay && (
        <Btn v="accent" s="lg" full onClick={() => setShowPay(true)}>
          <CreditCard size={16}/> Submit Payment — {peso(req.fee)}
        </Btn>
      )}
      {isResident && req.status === "awaiting_payment" && req.payStatus === "submitted" && (
        <div style={{ padding: "14px 16px", background: "#FFFBEB", borderRadius: "10px", border: "1px solid #FDE68A", display: "flex", alignItems: "center", gap: "10px" }}>
          <Clock size={16} color="#D97706"/>
          <span style={{ fontSize: "13px", color: "#92400E", fontWeight: 500 }}>Payment submitted. Waiting for staff verification.</span>
        </div>
      )}
      {showPay && (
        <div style={{ padding: "16px", background: "#F5F3FF", borderRadius: "10px", border: "1px solid #DDD6FE" }}>
          <Field label="Payment Method" required>
            <Select value={payMethod} onChange={setPayMethod} options={[
              { value: "gcash", label: "GCash (Upload proof)" },
              { value: "walk_in", label: "Walk-in (Pay at Barangay Hall)" },
            ]} placeholder="Choose method..."/>
          </Field>
          {payMethod === "gcash" && (
            <div style={{ padding: "12px", background: "#EDE9FE", borderRadius: "8px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Upload size={16} color="#7C3AED"/>
              <span style={{ fontSize: "12px", color: "#5B21B6" }}>GCash proof would be uploaded here (simulated)</span>
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn v="accent" s="sm" disabled={!payMethod} onClick={() => { onPayment(req.id, payMethod); setShowPay(false); }}>
              <Send size={14}/> Submit Payment
            </Btn>
            <Btn v="ghost" s="sm" onClick={() => setShowPay(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* Released → Download */}
      {req.status === "released" && (
        <div style={{ padding: "16px", background: "#F0FDF4", borderRadius: "10px", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle size={20} color="#059669"/>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#065F46" }}>Document Released</p>
              <p style={{ fontSize: "11px", color: "#6EE7B7" }}>{req.releasedAt ? fmtDate(req.releasedAt) : ""}</p>
            </div>
          </div>
          <Btn v="success" s="sm"><Download size={14}/> Download PDF</Btn>
        </div>
      )}
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN APPLICATION
   ═══════════════════════════════════════════════════════ */
export default function App() {
  // ─── State ───
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [requests, setRequests] = useState(SEED_REQUESTS);
  const [users, setUsers] = useState(SEED_USERS);
  const [logs, setLogs] = useState(SEED_LOGS);
  const [notifs, setNotifs] = useState(SEED_NOTIFS);
  const [toast, setToast] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [modal, setModal] = useState(null);
  const [rtPulse, setRtPulse] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  const flash = useCallback((msg, type = "info") => setToast({ message: msg, type }), []);

  const pulse = useCallback(() => {
    setRtPulse(true);
    setTimeout(() => setRtPulse(false), 1500);
  }, []);

  const log = useCallback((actor, action, detail) => {
    setLogs(p => [{ id: uid(), actor, action, detail, at: new Date().toISOString() }, ...p]);
  }, []);

  const notify = useCallback((userId, title, body) => {
    setNotifs(p => [{ id: uid(), userId, title, body, read: false, at: new Date().toISOString() }, ...p]);
  }, []);

  // Core action: update request status
  const handleAction = useCallback((reqId, newStatus, extra = {}) => {
    // FREE DOCUMENT AUTO-SKIP: if moving to awaiting_payment but fee is 0, skip to paid
    const req = requests.find(r => r.id === reqId);
    let finalStatus = newStatus;
    let finalExtra = { ...extra };
    if (req && newStatus === "awaiting_payment" && req.fee === 0) {
      finalStatus = "paid";
      finalExtra = { ...finalExtra, payMethod: "free", payStatus: "verified" };
    }

    setRequests(prev => prev.map(r => {
      if (r.id !== reqId) return r;
      return {
        ...r, status: finalStatus, updatedAt: new Date().toISOString(),
        ...(finalStatus === "released" ? { releasedAt: new Date().toISOString() } : {}),
        ...(finalStatus !== "rejected" && !r.staffId && user ? { staffId: user.id, staffName: user.name } : {}),
        ...finalExtra
      };
    }));
    if (req && user) {
      log(user.name, `Request → ${STATUS[finalStatus].label}`, `${req.docName} — ${req.residentName}`);
      notify(req.residentId, `Request ${STATUS[finalStatus].label}`, `Your ${req.docName} is now "${STATUS[finalStatus].label}".`);
      if (finalStatus === "awaiting_payment") {
        notify(req.residentId, "Payment Required", `Please submit payment of ${peso(req.fee)} for your ${req.docName}.`);
      }
      if (finalStatus === "paid" && req.fee === 0) {
        notify(req.residentId, "Free Document Approved", `Your ${req.docName} is free of charge and has been auto-approved for processing.`);
      }
      if (finalStatus === "released") {
        notify(req.residentId, "Document Ready", `Your ${req.docName} has been released. Download or pick up at the Barangay Hall.`);
      }
    }
    pulse();
    if (req && req.fee === 0 && newStatus === "awaiting_payment") {
      flash(`Free document — auto-skipped to Paid`, "success");
    } else {
      flash(`Request moved to ${STATUS[finalStatus].label}`, "success");
    }
    setSelectedReq(null);
  }, [requests, user, log, notify, pulse, flash]);

  // Edit request details (staff/admin only, during under_review or processing)
  const handleEdit = useCallback((reqId, updates) => {
    const req = requests.find(r => r.id === reqId);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
    if (req && user) {
      const changes = [];
      if (updates.docName && updates.docName !== req.docName) changes.push(`Document: ${req.docName} → ${updates.docName}`);
      if (updates.purpose && updates.purpose !== req.purpose) changes.push(`Purpose updated`);
      if (updates.residentName && updates.residentName !== req.residentName) changes.push(`Name: ${req.residentName} → ${updates.residentName}`);
      if (updates.fee !== undefined && updates.fee !== req.fee) changes.push(`Fee: ${peso(req.fee)} → ${peso(updates.fee)}`);
      const detail = changes.length > 0 ? changes.join(", ") : "Details updated";
      log(user.name, "Edited request", `${updates.docName || req.docName} — ${detail}`);
      notify(req.residentId, "Request Updated", `Your ${updates.docName || req.docName} request details have been updated by staff.`);
    }
    pulse();
    flash("Request details updated!", "success");
  }, [requests, user, log, notify, pulse, flash]);

  // Resident payment submission
  const handlePayment = useCallback((reqId, method) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, payMethod: method, payStatus: "submitted", updatedAt: new Date().toISOString() } : r));
    const req = requests.find(r => r.id === reqId);
    if (req) {
      log(user.name, "Payment submitted", `${method === "gcash" ? "GCash" : "Walk-in"} — ${peso(req.fee)} — ${req.docName}`);
      // notify all staff
      users.filter(u => u.role === "staff").forEach(s => {
        notify(s.id, "Payment Submitted", `${user.name} submitted ${method === "gcash" ? "GCash" : "walk-in"} payment for ${req.docName}.`);
      });
    }
    pulse();
    flash("Payment submitted! Staff will verify shortly.", "success");
    setSelectedReq(null);
  }, [requests, user, users, log, notify, pulse, flash]);

  // ─── Derived data ───
  const myNotifs = useMemo(() => user ? notifs.filter(n => n.userId === user.id) : [], [user, notifs]);
  const unreadCount = useMemo(() => myNotifs.filter(n => !n.read).length, [myNotifs]);

  const filteredRequests = useMemo(() => {
    let list = user?.role === "resident" ? requests.filter(r => r.residentId === user.id) : requests;
    if (filter !== "all") list = list.filter(r => r.status === filter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(r => r.residentName.toLowerCase().includes(q) || r.docName.toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [requests, user, filter, searchQ]);

  const statusCounts = useMemo(() => {
    const src = user?.role === "resident" ? requests.filter(r => r.residentId === user.id) : requests;
    const counts = { all: src.length };
    Object.keys(STATUS).forEach(s => { counts[s] = src.filter(r => r.status === s).length; });
    return counts;
  }, [requests, user]);

  /* ═══════════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════════ */
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#111827", display: "flex", fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,700;9..144,800&display=swap');
          @keyframes toastIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @keyframes livePulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0; } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #4B5563; border-radius: 3px; }
          input:focus, select:focus, textarea:focus { border-color: #2D6A4F !important; box-shadow: 0 0 0 3px rgba(45,106,79,0.1); }
        `}</style>
        {/* Left — Branding */}
        <div style={{ flex: 1, background: "linear-gradient(160deg, #1B4332 0%, #2D6A4F 60%, #40916C 100%)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px", position: "relative", overflow: "hidden", minHeight: "100vh" }}>
          <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "400px", height: "400px", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }}/>
          <div style={{ position: "absolute", bottom: "-150px", left: "-80px", width: "350px", height: "350px", borderRadius: "50%", background: "rgba(255,255,255,0.02)" }}/>
          <div style={{ position: "relative", zIndex: 1, animation: "fadeIn 0.6s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>
                <Shield size={26} color="#fff"/>
              </div>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff" }}>Barangay Maharlika</h1>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", textTransform: "uppercase" }}>Document Issuance System</p>
              </div>
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "42px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "20px", maxWidth: "420px" }}>
              Government services,<br/>now digital.
            </h2>
            <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: "380px" }}>
              Request barangay documents online, track status in real-time, and receive your documents without the hassle.
            </p>
            <div style={{ display: "flex", gap: "24px", marginTop: "48px" }}>
              {[{ n: "6", l: "Document Types" }, { n: "Real-time", l: "Status Updates" }, { n: "24/7", l: "Online Access" }].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#fff" }}>{s.n}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Right — Login */}
        <div style={{ width: "480px", background: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px", animation: "fadeIn 0.5s ease 0.1s both" }}>
          <h3 style={{ fontSize: "24px", fontWeight: 800, color: "#111827", marginBottom: "6px" }}>Sign in</h3>
          <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "36px" }}>Select a role to explore the system</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { u: SEED_USERS[0], desc: "Full system control, staff management, audit logs", accent: "#DC2626" },
              { u: SEED_USERS[1], desc: "Process requests, verify payments, release documents", accent: "#2563EB" },
              { u: SEED_USERS[3], desc: "Submit requests, track status, make payments", accent: "#059669" },
            ].map(({ u: su, desc, accent }) => (
              <button key={su.id} onClick={() => { setUser(su); setPage("dashboard"); flash(`Welcome, ${su.name}!`, "success"); }}
                style={{ display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px", background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "12px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s", width: "100%" }}
                onMouseOver={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = accent + "08"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fff"; }}>
                <Avatar initials={su.avatar} bg={accent}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{su.name}</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: accent, background: accent + "15", padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{su.role}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>{desc}</p>
                </div>
                <ArrowRight size={18} color="#D1D5DB"/>
              </button>
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "#D1D5DB", marginTop: "32px", textAlign: "center" }}>Demo mode — no password required</p>
        </div>
        {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     NAV CONFIG
     ═══════════════════════════════════════════ */
  const nav = {
    admin: [
      { key: "dashboard", icon: Home, label: "Dashboard" },
      { key: "requests", icon: FileText, label: "All Requests" },
      { key: "staff", icon: Users, label: "Staff" },
      { key: "verification", icon: UserCheck, label: "Verification" },
      { key: "audit", icon: Activity, label: "Audit Logs" },
      { key: "notifications", icon: Bell, label: "Notifications" },
      { key: "profile", icon: Settings, label: "Profile" },
    ],
    staff: [
      { key: "dashboard", icon: Home, label: "Dashboard" },
      { key: "requests", icon: FileText, label: "Requests" },
      { key: "verification", icon: UserCheck, label: "Verification" },
      { key: "notifications", icon: Bell, label: "Notifications" },
      { key: "profile", icon: Settings, label: "Profile" },
    ],
    resident: [
      { key: "dashboard", icon: Home, label: "Dashboard" },
      { key: "requests", icon: FileText, label: "My Requests" },
      { key: "new", icon: Plus, label: "New Request" },
      { key: "notifications", icon: Bell, label: "Notifications" },
      { key: "profile", icon: Settings, label: "Profile" },
    ],
  }[user.role];

  /* ═══════════════════════════════════════════
     PAGE: DASHBOARD
     ═══════════════════════════════════════════ */
  const PageDashboard = () => {
    const revenue = requests.filter(r => r.payStatus === "verified").reduce((s, r) => s + (r.fee || 0), 0);
    const actionable = requests.filter(r => ["pending", "under_review"].includes(r.status)).length;

    if (user.role === "resident") {
      const mine = requests.filter(r => r.residentId === user.id);
      const active = mine.filter(r => !["released", "rejected"].includes(r.status));
      return (
        <>
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#111827" }}>Good day, {user.name.split(" ")[0]}!</h2>
            <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "4px" }}>Here's an overview of your document requests</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "28px" }}>
            <Stat icon={FileText} label="Total" value={mine.length} accent="#2D6A4F"/>
            <Stat icon={Clock} label="Active" value={active.length} accent="#D97706" sub="In progress"/>
            <Stat icon={CheckCircle} label="Completed" value={mine.filter(r => r.status === "released").length} accent="#059669"/>
            <Stat icon={CreditCard} label="To Pay" value={mine.filter(r => r.status === "awaiting_payment" && !r.payStatus).length} accent="#7C3AED"/>
          </div>
          {active.length > 0 && (
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "12px" }}>Active Requests</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {active.map(r => (
                  <Card key={r.id} onClick={() => setSelectedReq(r)} style={{ padding: "18px 20px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>{r.docName}</span>
                          <Badge status={r.status}/>
                        </div>
                        <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>{r.purpose} • {ago(r.updatedAt)}</p>
                      </div>
                      <ChevronRight size={18} color="#D1D5DB"/>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          <Btn v="primary" s="lg" full onClick={() => setPage("new")} style={{ borderRadius: "12px" }}>
            <Plus size={18}/> Submit New Request
          </Btn>
        </>
      );
    }

    // Staff / Admin
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#111827" }}>{user.role === "admin" ? "Admin" : "Staff"} Dashboard</h2>
            <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "4px" }}>Overview of all document requests</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "#F0FDF4", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
            <div style={{ position: "relative", width: "8px", height: "8px" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981" }}/>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981", animation: rtPulse ? "livePulse 1.5s ease" : "none" }}/>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", letterSpacing: "0.5px" }}>LIVE</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "14px", marginBottom: "28px" }}>
          <Stat icon={FileText} label="Total" value={requests.length} accent="#2D6A4F"/>
          <Stat icon={AlertCircle} label="Needs Action" value={actionable} accent="#D97706" sub="Pending + Review"/>
          <Stat icon={TrendingUp} label="Revenue" value={peso(revenue)} accent="#7C3AED"/>
          <Stat icon={CheckCircle} label="Released" value={statusCounts.released || 0} accent="#059669"/>
          {user.role === "admin" && <Stat icon={Users} label="Staff" value={users.filter(u => u.role === "staff" && u.active).length} accent="#2563EB"/>}
        </div>

        {/* Pipeline */}
        <Card style={{ padding: "22px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pipeline</h3>
            <Btn v="ghost" s="xs" onClick={() => setPage("requests")}>View all <ArrowRight size={12}/></Btn>
          </div>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
            {["pending", "under_review", "awaiting_payment", "paid", "processing", "ready"].map((s, i) => {
              const c = STATUS[s]; const count = statusCounts[s] || 0;
              return (
                <div key={s} onClick={() => { setFilter(s); setPage("requests"); }}
                  style={{ flex: 1, minWidth: "80px", padding: "14px 10px", borderRadius: "10px", background: count > 0 ? c.bg : "#F9FAFB", textAlign: "center", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${count > 0 ? c.color + "30" : "#E5E7EB"}` }}>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: count > 0 ? c.color : "#D1D5DB" }}>{count}</div>
                  <div style={{ fontSize: "9px", fontWeight: 700, color: count > 0 ? c.color : "#9CA3AF", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.3px" }}>{c.label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Actionable Items */}
        {actionable > 0 && (
          <Card style={{ padding: "22px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
              Requires Your Action ({actionable})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {requests.filter(r => ["pending", "under_review"].includes(r.status) || (r.status === "awaiting_payment" && r.payStatus === "submitted")).slice(0, 5).map(r => (
                <div key={r.id} onClick={() => setSelectedReq(r)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", background: "#FFFBEB", border: "1px solid #FDE68A", cursor: "pointer", transition: "all 0.15s", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <Avatar initials={r.residentName.split(" ").map(w=>w[0]).join("")} size={30} bg="#D97706"/>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.docName}</p>
                      <p style={{ fontSize: "11px", color: "#6B7280" }}>{r.residentName} • {ago(r.createdAt)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <Badge status={r.status}/>
                    <ChevronRight size={16} color="#D1D5DB"/>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </>
    );
  };

  /* ═══════════════════════════════════════════
     PAGE: REQUESTS LIST
     ═══════════════════════════════════════════ */
  const PageRequests = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>
          {user.role === "resident" ? "My Requests" : "All Requests"}
        </h2>
        {user.role === "resident" && <Btn onClick={() => setPage("new")}><Plus size={14}/> New Request</Btn>}
      </div>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search size={16} color="#9CA3AF" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}/>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name, document, or purpose..."
          style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: "10px", border: "1.5px solid #E5E7EB", fontSize: "13px", outline: "none", fontFamily: "inherit", color: "#111827" }}/>
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", overflowX: "auto", paddingBottom: "4px" }}>
        <Pill active={filter === "all"} onClick={() => setFilter("all")} count={statusCounts.all}>All</Pill>
        {Object.keys(STATUS).map(s => (
          <Pill key={s} active={filter === s} onClick={() => setFilter(s)} count={statusCounts[s]}>{STATUS[s].label}</Pill>
        ))}
      </div>
      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredRequests.map(r => (
          <Card key={r.id} onClick={() => setSelectedReq(r)} style={{ padding: "16px 20px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                <Avatar initials={r.residentName.split(" ").map(w=>w[0]).join("")} size={34} bg={STATUS[r.status].color}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>{r.docName}</span>
                    <Badge status={r.status}/>
                    {r.payStatus === "submitted" && r.status === "awaiting_payment" && (
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#D97706", background: "#FEF3C7", padding: "2px 6px", borderRadius: "4px" }}>PAYMENT PENDING</span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "3px" }}>
                    {user.role !== "resident" && <>{r.residentName} • </>}{r.purpose} • {peso(r.fee)} • {ago(r.updatedAt)}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} color="#D1D5DB"/>
            </div>
          </Card>
        ))}
        {filteredRequests.length === 0 && (
          <EmptyState icon={FileText} title="No requests found" desc={filter !== "all" ? "Try a different filter" : "No matching requests"} />
        )}
      </div>
    </>
  );

  /* ═══════════════════════════════════════════
     PAGE: NEW REQUEST (Resident)
     ═══════════════════════════════════════════ */
  const PageNewRequest = () => {
    const [docTypeId, setDocTypeId] = useState("");
    const [purpose, setPurpose] = useState("");
    const selectedDoc = DOC_TYPES.find(d => d.id === parseInt(docTypeId));

    return (
      <div style={{ maxWidth: "520px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>New Request</h2>
        <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "28px" }}>Submit a document request to the barangay</p>

        <Card style={{ padding: "28px" }}>
          <Field label="Document Type" required>
            <Select value={docTypeId} onChange={setDocTypeId} placeholder="Choose a document..."
              options={DOC_TYPES.map(d => ({ value: d.id.toString(), label: `${d.name} — ${d.fee > 0 ? peso(d.fee) : "FREE"}` }))}/>
          </Field>

          {selectedDoc && (
            <div style={{ padding: "12px 14px", background: "#F0FDF4", borderRadius: "8px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FileText size={16} color="#059669"/>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#065F46" }}>{selectedDoc.name}</p>
                <p style={{ fontSize: "11px", color: "#6EE7B7" }}>{selectedDoc.desc} • Fee: {selectedDoc.fee > 0 ? peso(selectedDoc.fee) : "Free"}</p>
              </div>
            </div>
          )}

          <Field label="Purpose" required hint="Be specific — this helps staff process your request faster">
            <Textarea value={purpose} onChange={setPurpose} placeholder="e.g., Employment at ABC Corp., School enrollment for Grade 1..." rows={3}/>
          </Field>

          {!user.verified && (
            <div style={{ padding: "12px 14px", background: "#FEF2F2", borderRadius: "8px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertCircle size={16} color="#DC2626"/>
              <span style={{ fontSize: "12px", color: "#991B1B", fontWeight: 500 }}>Your account is not yet verified. Please wait for staff approval before submitting.</span>
            </div>
          )}

          <Btn v="primary" s="lg" full disabled={!docTypeId || !purpose.trim() || !user.verified}
            onClick={() => {
              const dt = DOC_TYPES.find(d => d.id === parseInt(docTypeId));
              const nr = {
                id: uid(), residentId: user.id, residentName: user.name,
                docTypeId: dt.id, docName: dt.name, status: "pending",
                purpose: purpose.trim(), fee: dt.fee,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
              };
              setRequests(p => [nr, ...p]);
              log(user.name, "Submitted request", dt.name);
              users.filter(u => u.role === "staff" || u.role === "admin").forEach(s => {
                notify(s.id, "New Request", `${user.name} requests ${dt.name} — ${purpose.trim().slice(0, 50)}`);
              });
              pulse();
              flash("Request submitted successfully!", "success");
              setPage("requests");
            }}>
            <Send size={16}/> Submit Request
          </Btn>
        </Card>
      </div>
    );
  };

  /* ═══════════════════════════════════════════
     PAGE: VERIFICATION
     ═══════════════════════════════════════════ */
  const PageVerification = () => {
    const pending = users.filter(u => u.role === "resident" && !u.verified);
    const verified = users.filter(u => u.role === "resident" && u.verified);

    return (
      <>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>Account Verification</h2>
        {pending.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Pending ({pending.length})
            </h3>
            {pending.map(u => (
              <Card key={u.id} style={{ padding: "20px", marginBottom: "10px", border: "1.5px solid #FDE68A" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Avatar initials={u.avatar} bg="#D97706"/>
                    <div>
                      <p style={{ fontWeight: 600, color: "#111827", fontSize: "14px" }}>{u.name}</p>
                      <p style={{ fontSize: "12px", color: "#6B7280" }}>{u.email} • {u.phone}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Btn v="success" s="sm" onClick={() => {
                      setUsers(p => p.map(usr => usr.id === u.id ? { ...usr, verified: true } : usr));
                      log(user.name, "Verified account", u.name);
                      notify(u.id, "Account Verified", "Your account is verified! You can now submit document requests.");
                      pulse(); flash(`${u.name} verified!`, "success");
                    }}><CheckCircle size={14}/> Approve</Btn>
                    <Btn v="danger" s="sm" onClick={() => {
                      log(user.name, "Rejected verification", u.name);
                      notify(u.id, "Verification Rejected", "Your account verification was rejected. Please upload a clearer valid ID.");
                      pulse(); flash(`${u.name} rejected`, "info");
                    }}><XCircle size={14}/> Reject</Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {pending.length === 0 && (
          <Card style={{ padding: "20px", marginBottom: "24px", background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle size={18} color="#059669"/>
              <span style={{ fontSize: "13px", color: "#065F46", fontWeight: 500 }}>All accounts are verified. No pending requests.</span>
            </div>
          </Card>
        )}
        <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Verified ({verified.length})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {verified.map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "#fff", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
              <CheckCircle size={14} color="#059669"/><span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{u.name}</span>
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{u.email}</span>
            </div>
          ))}
        </div>
      </>
    );
  };

  /* ═══════════════════════════════════════════
     PAGE: STAFF MANAGEMENT (Admin)
     ═══════════════════════════════════════════ */
  const PageStaff = () => {
    const staff = users.filter(u => u.role === "staff");
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>Staff Management</h2>
          <Btn onClick={() => setModal({ type: "add-staff", name: "", email: "", position: "", password: "staff123" })}><Plus size={14}/> Add Staff</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {staff.map(s => (
            <Card key={s.id} style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <Avatar initials={s.avatar} bg={s.active ? "#2563EB" : "#9CA3AF"}/>
                  <div>
                    <p style={{ fontWeight: 600, color: "#111827", fontSize: "14px" }}>{s.name}</p>
                    <p style={{ fontSize: "12px", color: "#6B7280" }}>{s.email} • {s.position}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px", background: s.active ? "#D1FAE5" : "#FEE2E2", color: s.active ? "#059669" : "#DC2626" }}>
                    {s.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                  <Btn v={s.active ? "danger" : "success"} s="xs" onClick={() => {
                    setUsers(p => p.map(u => u.id === s.id ? { ...u, active: !u.active } : u));
                    log(user.name, s.active ? "Deactivated staff" : "Activated staff", s.name);
                    flash(`${s.name} ${s.active ? "deactivated" : "activated"}`, "success");
                  }}>{s.active ? "Deactivate" : "Activate"}</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  };

  /* ═══════════════════════════════════════════
     PAGE: AUDIT LOGS
     ═══════════════════════════════════════════ */
  const PageAudit = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>Audit Logs</h2>
        <Btn v="secondary" onClick={() => flash("Exported to Excel!", "success")}><Download size={14}/> Export</Btn>
      </div>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["Timestamp", "Actor", "Action", "Details"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", color: "#6B7280", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 16px", color: "#6B7280", whiteSpace: "nowrap", fontSize: "12px" }}>{fmtTime(l.at)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{l.actor}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: "5px", background: "#F3F4F6", fontSize: "11px", fontWeight: 600, color: "#374151" }}>{l.action}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#6B7280", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );

  /* ═══════════════════════════════════════════
     PAGE: NOTIFICATIONS
     ═══════════════════════════════════════════ */
  const PageNotifications = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>Notifications</h2>
        {unreadCount > 0 && (
          <Btn v="secondary" s="sm" onClick={() => { setNotifs(p => p.map(n => n.userId === user.id ? { ...n, read: true } : n)); flash("All marked as read", "success"); }}>
            Mark all read
          </Btn>
        )}
      </div>
      {myNotifs.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" desc="You're all caught up!"/>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {myNotifs.map(n => (
            <div key={n.id} onClick={() => setNotifs(p => p.map(no => no.id === n.id ? { ...no, read: true } : no))}
              style={{ padding: "14px 18px", borderRadius: "10px", background: n.read ? "#fff" : "#F0FDF4", border: `1px solid ${n.read ? "#E5E7EB" : "#BBF7D0"}`, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {!n.read && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#059669" }}/>}
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{n.title}</p>
                  </div>
                  <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>{n.body}</p>
                </div>
                <span style={{ fontSize: "11px", color: "#9CA3AF", whiteSpace: "nowrap", marginLeft: "12px" }}>{ago(n.at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  /* ═══════════════════════════════════════════
     PAGE: PROFILE (All roles — role-specific fields)
     ═══════════════════════════════════════════ */
  const PageProfile = () => {
    // Resident fields
    const [phone, setPhone] = useState(user.phone || "");
    const [address, setAddress] = useState(user.address || "");
    const [cs, setCs] = useState(user.civil_status || "");
    // Admin fields
    const [adminName, setAdminName] = useState(user.name || "");
    const [adminEmail, setAdminEmail] = useState(user.email || "");
    // Shared password fields
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showPwSection, setShowPwSection] = useState(false);

    const handlePasswordChange = () => {
      const currentUser = users.find(u => u.id === user.id);
      if (currentPw !== (currentUser?.password || "")) {
        flash("Current password is incorrect", "error");
        return;
      }
      if (newPw.length < 6) {
        flash("New password must be at least 6 characters", "error");
        return;
      }
      if (newPw !== confirmPw) {
        flash("Passwords do not match", "error");
        return;
      }
      setUsers(p => p.map(u => u.id === user.id ? { ...u, password: newPw } : u));
      log(user.name, "Changed password", user.role === "admin" ? "Admin account" : "Staff account");
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setShowPwSection(false);
      flash("Password changed successfully!", "success");
    };

    // ─── ADMIN PROFILE ───
    if (user.role === "admin") {
      return (
        <div style={{ maxWidth: "520px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>Admin Profile</h2>
          <Card style={{ padding: "28px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #F3F4F6" }}>
              <Avatar initials={user.avatar} size={52} bg="#DC2626"/>
              <div>
                <p style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>{user.name}</p>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#DC2626", background: "#FEE2E2", padding: "3px 10px", borderRadius: "6px", textTransform: "uppercase" }}>Administrator</span>
              </div>
            </div>
            <Field label="Display Name" hint="This name appears across all dashboards">
              <Input value={adminName} onChange={setAdminName}/>
            </Field>
            <Field label="Email Address">
              <Input value={adminEmail} onChange={setAdminEmail} type="email"/>
            </Field>
            <Btn v="primary" s="lg" full onClick={() => {
              const oldName = user.name;
              const newAvatar = adminName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              setUsers(p => p.map(u => u.id === user.id ? { ...u, name: adminName.trim(), email: adminEmail.trim(), avatar: newAvatar } : u));
              setUser(p => ({ ...p, name: adminName.trim(), email: adminEmail.trim(), avatar: newAvatar }));
              if (adminName.trim() !== oldName) {
                log(adminName.trim(), "Updated admin profile", `Name: ${oldName} → ${adminName.trim()}`);
              } else {
                log(user.name, "Updated admin profile", "Email/profile updated");
              }
              flash("Profile updated!", "success");
            }}>
              <Save size={16}/> Save Profile
            </Btn>
          </Card>

          {/* Password Section */}
          <Card style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPwSection ? "20px" : "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Lock size={18} color="#6B7280"/>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Password</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>Change your account password</p>
                </div>
              </div>
              <Btn v="secondary" s="sm" onClick={() => setShowPwSection(!showPwSection)}>
                {showPwSection ? "Cancel" : "Change"}
              </Btn>
            </div>
            {showPwSection && (
              <>
                <Field label="Current Password" required>
                  <Input value={currentPw} onChange={setCurrentPw} type="password" placeholder="Enter current password"/>
                </Field>
                <Field label="New Password" required hint="Minimum 6 characters">
                  <Input value={newPw} onChange={setNewPw} type="password" placeholder="Enter new password"/>
                </Field>
                <Field label="Confirm New Password" required>
                  <Input value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Confirm new password"/>
                </Field>
                {newPw && confirmPw && newPw !== confirmPw && (
                  <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: "6px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertCircle size={12} color="#DC2626"/>
                    <span style={{ fontSize: "11px", color: "#991B1B" }}>Passwords do not match</span>
                  </div>
                )}
                <Btn v="primary" s="md" disabled={!currentPw || !newPw || newPw !== confirmPw || newPw.length < 6} onClick={handlePasswordChange}>
                  <Lock size={14}/> Update Password
                </Btn>
              </>
            )}
          </Card>
        </div>
      );
    }

    // ─── STAFF PROFILE ───
    if (user.role === "staff") {
      return (
        <div style={{ maxWidth: "520px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>Staff Profile</h2>
          <Card style={{ padding: "28px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #F3F4F6" }}>
              <Avatar initials={user.avatar} size={52} bg="#2563EB"/>
              <div>
                <p style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>{user.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563EB", background: "#DBEAFE", padding: "3px 10px", borderRadius: "6px", textTransform: "uppercase" }}>Staff</span>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{user.position}</span>
                </div>
              </div>
            </div>
            <Field label="Full Name" hint="Contact admin to change your name">
              <Input value={user.name} disabled/>
            </Field>
            <Field label="Email" hint="Contact admin to change your email">
              <Input value={user.email} disabled/>
            </Field>
            <Field label="Position">
              <Input value={user.position || ""} disabled/>
            </Field>
            <div style={{ padding: "12px 14px", background: "#EFF6FF", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={14} color="#2563EB"/>
              <span style={{ fontSize: "12px", color: "#1E40AF" }}>Name, email, and position can only be changed by the admin.</span>
            </div>
          </Card>

          {/* Password Section */}
          <Card style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPwSection ? "20px" : "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Lock size={18} color="#6B7280"/>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Password</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>Change your account password</p>
                </div>
              </div>
              <Btn v="secondary" s="sm" onClick={() => setShowPwSection(!showPwSection)}>
                {showPwSection ? "Cancel" : "Change"}
              </Btn>
            </div>
            {showPwSection && (
              <>
                <Field label="Current Password" required>
                  <Input value={currentPw} onChange={setCurrentPw} type="password" placeholder="Enter current password"/>
                </Field>
                <Field label="New Password" required hint="Minimum 6 characters">
                  <Input value={newPw} onChange={setNewPw} type="password" placeholder="Enter new password"/>
                </Field>
                <Field label="Confirm New Password" required>
                  <Input value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Confirm new password"/>
                </Field>
                {newPw && confirmPw && newPw !== confirmPw && (
                  <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: "6px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertCircle size={12} color="#DC2626"/>
                    <span style={{ fontSize: "11px", color: "#991B1B" }}>Passwords do not match</span>
                  </div>
                )}
                <Btn v="primary" s="md" disabled={!currentPw || !newPw || newPw !== confirmPw || newPw.length < 6} onClick={handlePasswordChange}>
                  <Lock size={14}/> Update Password
                </Btn>
              </>
            )}
          </Card>
        </div>
      );
    }

    // ─── RESIDENT PROFILE ───
    return (
      <div style={{ maxWidth: "520px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>My Profile</h2>
        <Card style={{ padding: "28px" }}>
          <Field label="Full Name" hint="Name cannot be changed after registration">
            <Input value={user.name} disabled/>
          </Field>
          <Field label="Email">
            <Input value={user.email} disabled/>
          </Field>
          <Field label="Phone Number">
            <Input value={phone} onChange={setPhone} placeholder="0917-123-4567"/>
          </Field>
          <Field label="Address">
            <Textarea value={address} onChange={setAddress} rows={2}/>
          </Field>
          <Field label="Civil Status">
            <Select value={cs} onChange={setCs} options={["Single","Married","Widowed","Separated"].map(s => ({ value: s, label: s }))}/>
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px", background: user.verified ? "#F0FDF4" : "#FEF2F2", borderRadius: "8px", marginBottom: "20px", border: `1px solid ${user.verified ? "#BBF7D0" : "#FECACA"}` }}>
            {user.verified ? <CheckCircle size={16} color="#059669"/> : <AlertCircle size={16} color="#DC2626"/>}
            <span style={{ fontSize: "12px", fontWeight: 600, color: user.verified ? "#065F46" : "#991B1B" }}>
              {user.verified ? "Account Verified" : "Pending Verification"}
            </span>
          </div>
          <Btn v="primary" s="lg" full onClick={() => {
            setUsers(p => p.map(u2 => u2.id === user.id ? { ...u2, phone, address, civil_status: cs } : u2));
            setUser(p => ({ ...p, phone, address, civil_status: cs }));
            flash("Profile updated!", "success");
          }}>Save Changes</Btn>
        </Card>
      </div>
    );
  };

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  const pages = { dashboard: PageDashboard, requests: PageRequests, new: PageNewRequest, verification: PageVerification, staff: PageStaff, audit: PageAudit, notifications: PageNotifications, profile: PageProfile };
  const PageComponent = pages[page] || PageDashboard;

  const roleColors = { admin: "#DC2626", staff: "#2563EB", resident: "#059669" };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif", background: "#F3F4F6", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,700;9..144,800&display=swap');
        @keyframes toastIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes livePulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(2); opacity: 0; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        input:focus, select:focus, textarea:focus { border-color: #2D6A4F !important; box-shadow: 0 0 0 3px rgba(45,106,79,0.1); }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width: "240px", background: "#111827", color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid #1F2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#2D6A4F", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={18} color="#fff"/>
            </div>
            <div>
              <h1 style={{ fontSize: "14px", fontWeight: 700 }}>Brgy. Maharlika</h1>
              <p style={{ fontSize: "10px", color: "#6B7280", letterSpacing: "1px", textTransform: "uppercase" }}>Doc System</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {nav.map(item => {
            const active = page === item.key;
            return (
              <button key={item.key} onClick={() => { setPage(item.key); if (item.key === "requests") { setFilter("all"); setSearchQ(""); } }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px", border: "none", background: active ? "#1F2937" : "transparent", color: active ? "#fff" : "#9CA3AF", fontSize: "13px", fontWeight: active ? 600 : 500, cursor: "pointer", fontFamily: "inherit", marginBottom: "2px", transition: "all 0.15s", position: "relative" }}>
                <item.icon size={18}/>
                <span>{item.label}</span>
                {item.key === "notifications" && unreadCount > 0 && (
                  <span style={{ marginLeft: "auto", background: "#DC2626", color: "#fff", fontSize: "10px", fontWeight: 700, minWidth: "18px", height: "18px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{unreadCount}</span>
                )}
                {active && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "3px", height: "20px", background: "#2D6A4F", borderRadius: "0 3px 3px 0" }}/>}
              </button>
            );
          })}
        </nav>
        {/* User Info + Logout */}
        <div style={{ padding: "16px", borderTop: "1px solid #1F2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <Avatar initials={user.avatar} size={32} bg={roleColors[user.role]}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
              <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{user.role}</p>
            </div>
          </div>
          <button onClick={() => { setUser(null); setPage("dashboard"); setFilter("all"); setSearchQ(""); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", border: "none", background: "#1F2937", color: "#9CA3AF", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            <LogOut size={14}/> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header style={{ padding: "14px 28px", background: "#fff", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {nav.find(n => n.key === page)?.icon && (() => { const I = nav.find(n => n.key === page).icon; return <I size={18} color="#6B7280"/>; })()}
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>{nav.find(n => n.key === page)?.label || "Dashboard"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "6px", background: rtPulse ? "#F0FDF4" : "#F9FAFB", border: `1px solid ${rtPulse ? "#BBF7D0" : "#E5E7EB"}`, transition: "all 0.3s" }}>
              <div style={{ position: "relative", width: "6px", height: "6px" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981" }}/>
                {rtPulse && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981", animation: "livePulse 1.5s ease" }}/>}
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#059669", letterSpacing: "0.5px" }}>LIVE</span>
            </div>
            <button onClick={() => setPage("notifications")} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: "6px" }}>
              <Bell size={18} color="#6B7280"/>
              {unreadCount > 0 && <span style={{ position: "absolute", top: "0", right: "0", width: "14px", height: "14px", background: "#DC2626", borderRadius: "50%", fontSize: "9px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{unreadCount}</span>}
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px" }}>
          <PageComponent/>
        </div>
      </main>

      {/* ── Request Detail Modal ── */}
      {selectedReq && (
        <RequestDetail
          req={requests.find(r => r.id === selectedReq.id) || selectedReq}
          user={user}
          onClose={() => setSelectedReq(null)}
          onAction={handleAction}
          onPayment={handlePayment}
          onEdit={handleEdit}
        />
      )}

      {/* ── Add Staff Modal ── */}
      {modal?.type === "add-staff" && (
        <Modal title="Add Staff Member" onClose={() => setModal(null)}>
          <Field label="Full Name" required><Input value={modal.name} onChange={v => setModal(p => ({ ...p, name: v }))} placeholder="Full name"/></Field>
          <Field label="Email" required><Input value={modal.email} onChange={v => setModal(p => ({ ...p, email: v }))} placeholder="staff@brgy-maharlika.gov.ph"/></Field>
          <Field label="Position"><Input value={modal.position} onChange={v => setModal(p => ({ ...p, position: v }))} placeholder="e.g., Clerk, Processor"/></Field>
          <Field label="Default Password" hint="Staff can change this in their profile">
            <Input value={modal.password} onChange={v => setModal(p => ({ ...p, password: v }))} type="password"/>
          </Field>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
            <Btn v="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn disabled={!modal.name || !modal.email} onClick={() => {
              const initials = modal.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              setUsers(p => [...p, { id: uid(), email: modal.email, role: "staff", name: modal.name, verified: true, avatar: initials, position: modal.position || "Staff", active: true, password: modal.password || "staff123" }]);
              log(user.name, "Added staff", modal.name);
              flash(`${modal.name} added as staff`, "success");
              setModal(null);
            }}>Add Staff</Btn>
          </div>
        </Modal>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
    </div>
  );
}