import { useState, useCallback } from "react";

const MEMBERS = [
  { name: "Álvaro", color: "#60A5FA", emoji: "🎸", avatar: "Á" },
  { name: "Misa", color: "#F59E0B", emoji: "🎮", avatar: "M" },
  { name: "Sara", color: "#F472B6", emoji: "🌸", avatar: "S" },
  { name: "Juan", color: "#34D399", emoji: "⚽", avatar: "J" },
  { name: "Marta", color: "#A78BFA", emoji: "📚", avatar: "Mt" },
  { name: "Damián", color: "#FB7185", emoji: "🎬", avatar: "D" },
];

const SLOTS = ["Mañana", "Tarde", "Noche"];
const SLOT_HOURS = { "Mañana": "8:00 – 14:00", "Tarde": "14:00 – 20:00", "Noche": "20:00 – 00:00" };

const today = new Date(2026, 1, 6);

function dKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function sameDay(a, b) { return a && b && dKey(a) === dKey(b); }

function getWeekDays(base, offset) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset * 7);
  const mon = new Date(d);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(x.getDate() + i); return x; });
}

function getMonthDays(base, offset) {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDow = (d.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= last; i++) cells.push(new Date(d.getFullYear(), d.getMonth(), i));
  return { cells, month: d };
}

const WEATHER = {};
(() => {
  const icons = ["🌤️","⛅","☀️","🌧️","⛅","☀️","☀️","🌤️","☀️","⛅","🌧️","☀️","☀️","🌤️"];
  const temps = [14,12,16,10,13,18,19,15,17,11,9,20,18,16];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    WEATHER[dKey(d)] = { icon: icons[i], temp: temps[i] };
  }
})();

const INITIAL_AVAIL = {};
MEMBERS.forEach(m => { INITIAL_AVAIL[m.name] = {}; });
(() => {
  const week = getWeekDays(today, 0);
  const next = getWeekDays(today, 1);
  ["Misa","Sara","Juan","Marta","Damián"].forEach(n => { INITIAL_AVAIL[n][dKey(week[5])] = { type: "day" }; });
  ["Misa","Juan","Damián"].forEach(n => { INITIAL_AVAIL[n][dKey(week[6])] = { type: "day" }; });
  ["Sara","Marta"].forEach(n => { INITIAL_AVAIL[n][dKey(week[4])] = { type: "slots", slots: ["Tarde","Noche"] }; });
  MEMBERS.forEach(n => { INITIAL_AVAIL[n.name][dKey(next[5])] = { type: "day" }; });
  ["Álvaro","Misa","Sara","Juan"].forEach(n => { INITIAL_AVAIL[n][dKey(next[4])] = { type: "slots", slots: ["Tarde"] }; });
})();

const INITIAL_QUEDADAS = [
  { id: 1, title: "Ruta Los Cahorros", date: "2026-02-14", location: "Monachil, Granada", time: "10:00", attendees: MEMBERS.map(m=>m.name), status: "confirmed" },
  { id: 2, title: "Cena japonesa", date: "2026-01-24", location: "Sakura, Centro", time: "21:00", attendees: ["Álvaro","Misa","Sara","Damián"], status: "past" },
];

const CHAT_FLOW = [
  { q: "mejor", a: "Analizando disponibilidades y previsión meteorológica...\n\n📅 **Sábado 14 de febrero** es vuestro mejor día:\n\n→ 6/6 personas disponibles\n→ ☀️ 20° — Tiempo perfecto\n→ Día completo libre para todos\n\n¿Queréis que cree una quedada para ese día?" },
  { q: "ruta", a: "Para senderismo cerca de Granada, con ☀️ y 20° el sábado 14:\n\n🥾 **Los Cahorros (Monachil)** — 3h, nivel medio, puentes colgantes\n🏔️ **Vereda de la Estrella** — 5h, nivel medio-alto, vistas a Sierra Nevada\n🌿 **Ruta del Río Dílar** — 2h, nivel fácil, ideal para todos\n\n¿Programo alguna de estas?" },
  { q: "tiempo", a: "Previsión para los próximos días:\n\n📅 Hoy viernes → 🌤️ 14°\n📅 Sábado 7 → ⛅ 12°\n📅 Domingo 8 → ☀️ 16°\n📅 Sábado 14 → ☀️ 20° ← Mejor día\n📅 Domingo 15 → ☀️ 19°\n\nEl fin de semana del 14-15 es claramente el mejor para actividades al aire libre." },
  { q: "quedar", a: "He cruzado todas las disponibilidades:\n\n🟢 **Sáb 14 feb** — 6/6 disponibles (☀️ 20°) ← Recomendado\n🟡 **Sáb 7 feb** — 5/6 disponibles (⛅ 12°)\n🟡 **Dom 8 feb** — 3/6 disponibles (☀️ 16°)\n🟠 **Vie 6 feb** — 2/6 disponibles (🌤️ 14°)\n\nEl 14 de febrero es vuestro día. ¿Lo agendamos?" },
];

function Avatar({ member, size = 32 }) {
  const m = MEMBERS.find(x => x.name === member) || { color: "#475569", avatar: "?", emoji: "" };
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.35, background: `${m.color}18`, border: `1.5px solid ${m.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: m.color, flexShrink: 0 }}>
      {m.avatar}
    </div>
  );
}

function AvatarStack({ names, size = 24 }) {
  return (
    <div style={{ display: "flex" }}>
      {names.slice(0, 6).map((n, i) => (
        <div key={n} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}>
          <Avatar member={n} size={size} />
        </div>
      ))}
    </div>
  );
}

function TabIcon({ name, active }) {
  const c = active ? "#60A5FA" : "#3E4C63";
  if (name === "calendar") return <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3" stroke={c} strokeWidth="1.7"/><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.7"/></svg>;
  if (name === "plans") return <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" stroke={c} strokeWidth="1.7"/><path d="M9 7h6M9 11h6M9 15h3" stroke={c} strokeWidth="1.7" strokeLinecap="round"/></svg>;
  if (name === "group") return <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="3" stroke={c} strokeWidth="1.7"/><path d="M3 18c0-3 3-5 6-5s6 2 6 5" stroke={c} strokeWidth="1.7"/><circle cx="17" cy="8" r="2" stroke={c} strokeWidth="1.7"/><path d="M21 18c0-2-1.5-3.5-4-4" stroke={c} strokeWidth="1.7"/></svg>;
  if (name === "chat") return <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 21c5 0 9-3.6 9-8s-4-8-9-8-9 3.6-9 8c0 1.8.7 3.5 1.8 4.8L3 21l3.2-1.5c1.7 1 3.7 1.5 5.8 1.5z" stroke={c} strokeWidth="1.7"/></svg>;
  return null;
}

const S = {
  app: { maxWidth: 430, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: "#080E1A", fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", color: "#E2E8F0", position: "relative", overflow: "hidden" },
  content: { flex: 1, overflowY: "auto", padding: "0 16px 96px", WebkitOverflowScrolling: "touch" },
  tabBar: { position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", background: "rgba(8,14,26,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "6px 0 26px", zIndex: 50 },
  tab: (a) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: a ? "#60A5FA" : "#3E4C63", fontSize: 10, fontWeight: a ? 600 : 500, cursor: "pointer", padding: "4px 0", letterSpacing: 0.1 }),
  card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "12px 14px", marginBottom: 6 },
  btn: (p) => ({ background: p ? "#2563EB" : "rgba(255,255,255,0.04)", color: p ? "#fff" : "#7B8CA8", border: p ? "none" : "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  badge: (c) => ({ display: "inline-flex", alignItems: "center", background: `${c}12`, color: c, borderRadius: 7, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }),
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  modalInner: { background: "#0F1729", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 36px" },
  input: { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "11px 13px", color: "#E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box" },
};

export default function QuedamosApp() {
  const [tab, setTab] = useState("splash");
  const [avail, setAvail] = useState(INITIAL_AVAIL);
  const [quedadas, setQuedadas] = useState(INITIAL_QUEDADAS);
  const [calView, setCalView] = useState("week");
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [selDay, setSelDay] = useState(null);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availForm, setAvailForm] = useState({ type: "day", slots: [], fromH: "16", toH: "22" });
  const [newQ, setNewQ] = useState({ title: "", location: "", time: "" });
  const [chatMsgs, setChatMsgs] = useState([{ role: "ai", text: "¡Hola! Soy el asistente de Quedamos. Pregúntame cosas como:\n\n• ¿Cuál es el mejor día para quedar?\n• ¿Qué tiempo hará este finde?\n• Sugiéreme una ruta de senderismo" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [notif, setNotif] = useState(null);
  const currentUser = "Álvaro";

  const showNotif = useCallback((msg) => { setNotif(msg); setTimeout(() => setNotif(null), 2500); }, []);

  const getAvailMembers = useCallback((day) => {
    if (!day) return [];
    const k = dKey(day);
    return MEMBERS.filter(m => avail[m.name]?.[k]);
  }, [avail]);

  const getBestDay = useCallback(() => {
    const allDays = [...getWeekDays(today, 0), ...getWeekDays(today, 1)];
    let best = null, bestScore = 0;
    allDays.forEach(d => {
      if (d < today) return;
      const count = getAvailMembers(d).length;
      const w = WEATHER[dKey(d)];
      const wb = w?.icon === "☀️" ? 2 : w?.icon === "🌧️" ? -3 : 0;
      const score = count * 10 + wb;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }, [getAvailMembers]);

  const saveAvail = () => {
    if (!selDay) return;
    const k = dKey(selDay);
    const entry = availForm.type === "day" ? { type: "day" }
      : availForm.type === "slots" ? { type: "slots", slots: [...availForm.slots] }
      : { type: "range", from: availForm.fromH + ":00", to: availForm.toH + ":00" };
    setAvail(prev => ({ ...prev, [currentUser]: { ...prev[currentUser], [k]: entry } }));
    setShowAvailModal(false);
    showNotif(`✅ Disponibilidad guardada`);
  };

  const removeAvail = () => {
    if (!selDay) return;
    setAvail(prev => { const c = { ...prev, [currentUser]: { ...prev[currentUser] } }; delete c[currentUser][dKey(selDay)]; return c; });
    setShowAvailModal(false);
    showNotif("Disponibilidad eliminada");
  };

  const createQuedada = () => {
    if (!newQ.title || !selDay) return;
    setQuedadas(prev => [...prev, { id: Date.now(), title: newQ.title, date: dKey(selDay), location: newQ.location, time: newQ.time, attendees: getAvailMembers(selDay).map(m => m.name), status: "pending" }]);
    setShowCreateModal(false);
    setNewQ({ title: "", location: "", time: "" });
    showNotif(`🎉 "${newQ.title}" creada`);
  };

  const sendChat = () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.toLowerCase();
    setChatMsgs(prev => [...prev, { role: "user", text: chatInput }]);
    setChatInput("");
    setChatLoading(true);
    setTimeout(() => {
      const match = CHAT_FLOW.find(r => msg.includes(r.q));
      const fallback = `He analizado las disponibilidades del grupo. El próximo día donde coincidís más personas es el ${getBestDay()?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) || "sábado 14 de febrero"}. ¿Quieres más detalles?`;
      setChatMsgs(prev => [...prev, { role: "ai", text: match?.a || fallback }]);
      setChatLoading(false);
    }, 1200);
  };

  const bestDay = getBestDay();

  // SPLASH
  if (tab === "splash") {
    return (
      <div style={{ ...S.app, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 65%)" }} />
        <div style={{ fontSize: 48, marginBottom: 8 }}>📅</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: -1.2, color: "#F1F5F9" }}>Quedamos</h1>
        <p style={{ color: "#4B5C75", fontSize: 14, textAlign: "center", lineHeight: 1.6, margin: "10px 0 28px", maxWidth: 240 }}>
          El momento perfecto para quedar con tu grupo.
        </p>
        <div style={{ display: "flex", gap: 5, marginBottom: 36, flexWrap: "wrap", justifyContent: "center" }}>
          {MEMBERS.map(m => (
            <div key={m.name} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, padding: "4px 11px", display: "flex", alignItems: "center", gap: 5, border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 11 }}>{m.emoji}</span>
              <span style={{ color: m.color, fontSize: 11, fontWeight: 600 }}>{m.name}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setTab("calendar")} style={{ ...S.btn(true), padding: "14px 52px", fontSize: 15, borderRadius: 13, boxShadow: "0 4px 20px rgba(37,99,235,0.25)" }}>
          Empezar
        </button>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {notif && (
        <div style={{ position: "absolute", top: 10, left: 12, right: 12, zIndex: 200, background: "#1D4ED8", color: "#fff", padding: "11px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
          {notif}
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#F1F5F9", letterSpacing: -0.2 }}>
            {tab === "calendar" ? "Calendario" : tab === "plans" ? "Quedadas" : tab === "group" ? "Grupo" : "Chat IA"}
          </h1>
        </div>
        <Avatar member={currentUser} size={32} />
      </div>

      <div style={S.content}>

        {/* ===== CALENDAR ===== */}
        {tab === "calendar" && (
          <div>
            <div style={{ display: "flex", gap: 3, margin: "8px 0 10px", background: "rgba(255,255,255,0.025)", borderRadius: 9, padding: 3 }}>
              {[["week","Semana"],["month","Mes"],["list","Lista"]].map(([k,l]) => (
                <button key={k} onClick={() => { setCalView(k); setSelDay(null); }} style={{ flex: 1, background: calView === k ? "rgba(37,99,235,0.12)" : "transparent", color: calView === k ? "#60A5FA" : "#4B5C75", border: "none", borderRadius: 7, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
              ))}
            </div>

            {bestDay && (
              <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(96,165,250,0.1)", borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#60A5FA", fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Mejor día</div>
                  <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 1 }}>
                    {bestDay.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })} · {getAvailMembers(bestDay).length}/{MEMBERS.length} · {WEATHER[dKey(bestDay)]?.icon} {WEATHER[dKey(bestDay)]?.temp}°
                  </div>
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calView === "week" && (() => {
              const week = getWeekDays(today, weekOff);
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <button onClick={() => setWeekOff(w=>w-1)} style={{ background: "none", border: "none", color: "#4B5C75", fontSize: 16, cursor: "pointer", padding: "4px 8px" }}>‹</button>
                    <span style={{ color: "#7B8CA8", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                      {week[0].toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                    </span>
                    <button onClick={() => setWeekOff(w=>w+1)} style={{ background: "none", border: "none", color: "#4B5C75", fontSize: 16, cursor: "pointer", padding: "4px 8px" }}>›</button>
                  </div>
                  {week.map(day => {
                    const k = dKey(day);
                    const members = getAvailMembers(day);
                    const isSel = sameDay(selDay, day);
                    const isToday = sameDay(day, today);
                    const isBest = sameDay(day, bestDay);
                    const w = WEATHER[k];
                    const userA = avail[currentUser]?.[k];
                    const availLabel = userA ? (userA.type === "day" ? "Todo el día" : userA.type === "slots" ? userA.slots.join(", ") : `${userA.from} – ${userA.to}`) : null;

                    return (
                      <div key={k} onClick={() => setSelDay(isSel ? null : day)} style={{
                        ...S.card, marginBottom: 4, cursor: "pointer",
                        border: `1px solid ${isBest && !isSel ? "rgba(96,165,250,0.12)" : isSel ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.035)"}`,
                        background: isSel ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.015)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ textAlign: "center", minWidth: 36 }}>
                              <div style={{ fontSize: 9, color: "#4B5C75", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                {day.toLocaleDateString("es-ES", { weekday: "short" })}
                              </div>
                              <div style={{ fontSize: 19, fontWeight: 700, color: isToday ? "#60A5FA" : "#CBD5E1", lineHeight: 1.2 }}>
                                {day.getDate()}
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                {members.length > 0 ? <AvatarStack names={members.map(m=>m.name)} size={18} /> : null}
                                <span style={{ fontSize: 11, color: members.length > 0 ? "#64748B" : "#334155", marginLeft: 2 }}>
                                  {members.length > 0 ? `${members.length}/${MEMBERS.length}` : "—"}
                                </span>
                              </div>
                              {availLabel && <div style={{ fontSize: 10, color: "#3B82F6", marginTop: 2 }}>Tú: {availLabel}</div>}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            {w && <div style={{ fontSize: 15 }}>{w.icon}</div>}
                            {w && <div style={{ fontSize: 10, color: "#4B5C75" }}>{w.temp}°</div>}
                          </div>
                        </div>
                        {isSel && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); setAvailForm({ type: "day", slots: [], fromH: "16", toH: "22" }); setShowAvailModal(true); }} style={{ ...S.btn(true), flex: 1, padding: "8px", fontSize: 12 }}>
                              {userA ? "Editar disponibilidad" : "Estoy disponible"}
                            </button>
                            {members.length >= 2 && (
                              <button onClick={e => { e.stopPropagation(); setNewQ({ title: "", location: "", time: "" }); setShowCreateModal(true); }} style={{ ...S.btn(false), flex: 1, padding: "8px", fontSize: 12 }}>
                                Crear quedada
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* MONTH VIEW */}
            {calView === "month" && (() => {
              const { cells, month } = getMonthDays(today, monthOff);
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <button onClick={() => setMonthOff(m=>m-1)} style={{ background: "none", border: "none", color: "#4B5C75", fontSize: 16, cursor: "pointer" }}>‹</button>
                    <span style={{ color: "#7B8CA8", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                      {month.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                    </span>
                    <button onClick={() => setMonthOff(m=>m+1)} style={{ background: "none", border: "none", color: "#4B5C75", fontSize: 16, cursor: "pointer" }}>›</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
                    {["L","M","X","J","V","S","D"].map(d => (
                      <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#3E4C63", fontWeight: 600, padding: 3 }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                    {cells.map((day, i) => {
                      if (!day) return <div key={`e${i}`} />;
                      const members = getAvailMembers(day);
                      const ratio = members.length / MEMBERS.length;
                      const isT = sameDay(day, today);
                      const isSel = sameDay(day, selDay);
                      return (
                        <div key={dKey(day)} onClick={() => setSelDay(isSel ? null : day)} style={{
                          textAlign: "center", padding: "7px 2px", borderRadius: 9, cursor: "pointer",
                          background: isSel ? "rgba(37,99,235,0.18)" : ratio > 0.5 ? `rgba(96,165,250,${ratio * 0.12})` : "transparent",
                          border: isT ? "1px solid rgba(96,165,250,0.3)" : "1px solid transparent",
                        }}>
                          <div style={{ fontSize: 12, fontWeight: isT ? 700 : 400, color: isSel ? "#60A5FA" : isT ? "#60A5FA" : "#94A3B8" }}>{day.getDate()}</div>
                          {members.length > 0 && (
                            <div style={{ display: "flex", justifyContent: "center", gap: 1, marginTop: 2 }}>
                              {members.slice(0,4).map(m => <div key={m.name} style={{ width: 3, height: 3, borderRadius: 2, background: m.color }} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selDay && (
                    <div style={{ ...S.card, marginTop: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>
                        {selDay.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                      </div>
                      {(() => { const m = getAvailMembers(selDay); return m.length > 0
                        ? <><AvatarStack names={m.map(x=>x.name)} /><div style={{fontSize:10,color:"#4B5C75",marginTop:3}}>{m.map(x=>x.name).join(", ")}</div></>
                        : <div style={{fontSize:11,color:"#334155"}}>Nadie disponible</div>; })()}
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button onClick={() => { setAvailForm({ type: "day", slots: [], fromH: "16", toH: "22" }); setShowAvailModal(true); }} style={{ ...S.btn(true), flex: 1, padding: "7px", fontSize: 12 }}>Disponible</button>
                        <button onClick={() => { setNewQ({ title: "", location: "", time: "" }); setShowCreateModal(true); }} style={{ ...S.btn(false), flex: 1, padding: "7px", fontSize: 12 }}>Crear quedada</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* LIST VIEW */}
            {calView === "list" && (() => {
              const allDays = [...getWeekDays(today, 0), ...getWeekDays(today, 1)].filter(d => d >= today && getAvailMembers(d).length > 0);
              return (
                <div>
                  <div style={{ fontSize: 11, color: "#3E4C63", marginBottom: 6, fontWeight: 500 }}>Días con disponibilidad</div>
                  {allDays.map(day => {
                    const members = getAvailMembers(day);
                    const w = WEATHER[dKey(day)];
                    const isBest = sameDay(day, bestDay);
                    return (
                      <div key={dKey(day)} onClick={() => { setSelDay(day); setCalView("week"); }} style={{ ...S.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1", display: "flex", alignItems: "center", gap: 6 }}>
                            {day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
                            {isBest && <span style={S.badge("#60A5FA")}>Recomendado</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <AvatarStack names={members.map(m=>m.name)} size={16} />
                            <span style={{ fontSize: 10, color: "#3E4C63" }}>{members.length}/{MEMBERS.length}</span>
                          </div>
                        </div>
                        {w && <div style={{ textAlign: "center" }}><div style={{ fontSize: 16 }}>{w.icon}</div><div style={{ fontSize: 9, color: "#3E4C63" }}>{w.temp}°</div></div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ===== PLANS ===== */}
        {tab === "plans" && (
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: "#3E4C63", margin: "0 0 6px", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Próximas</div>
            {quedadas.filter(q => q.status !== "past").map(q => (
              <div key={q.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>{q.title}</div>
                    <div style={{ fontSize: 11, color: "#4B5C75", marginTop: 3, lineHeight: 1.5 }}>
                      📍 {q.location}<br/>
                      📅 {new Date(q.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                      {q.time && ` · ${q.time}`}
                    </div>
                  </div>
                  <span style={S.badge(q.status === "confirmed" ? "#34D399" : "#F59E0B")}>
                    {q.status === "confirmed" ? "Confirmada" : "Pendiente"}
                  </span>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <AvatarStack names={q.attendees} size={22} />
                  <span style={{ fontSize: 10, color: "#3E4C63" }}>{q.attendees.length} asistentes</span>
                </div>
                {q.status === "pending" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button onClick={() => { setQuedadas(p => p.map(x => x.id === q.id ? {...x, status: "confirmed"} : x)); showNotif("✅ Confirmada"); }} style={{ ...S.btn(true), flex: 1, padding: "7px", fontSize: 12 }}>Confirmar</button>
                    <button style={{ ...S.btn(false), flex: 1, padding: "7px", fontSize: 12 }}>Rechazar</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#3E4C63", margin: "14px 0 6px", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Pasadas</div>
            {quedadas.filter(q => q.status === "past").map(q => (
              <div key={q.id} style={{ ...S.card, opacity: 0.4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#7B8CA8" }}>{q.title}</div>
                <div style={{ fontSize: 10, color: "#3E4C63", marginTop: 2 }}>📍 {q.location} · {new Date(q.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
                <div style={{ marginTop: 5 }}><AvatarStack names={q.attendees} size={18} /></div>
              </div>
            ))}
          </div>
        )}

        {/* ===== GROUP ===== */}
        {tab === "group" && (
          <div style={{ paddingTop: 8 }}>
            {MEMBERS.map(m => {
              const days = Object.keys(avail[m.name] || {}).length;
              return (
                <div key={m.name} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar member={m.name} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "#3E4C63" }}>{days > 0 ? `${days} días marcados` : "Sin disponibilidad"}</div>
                  </div>
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                </div>
              );
            })}
            <div style={{ ...S.card, marginTop: 10, textAlign: "center", padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7B8CA8", marginBottom: 12 }}>Estadísticas</div>
              <div style={{ display: "flex", justifyContent: "space-around" }}>
                {[["2","Quedadas","#60A5FA"],["87%","Asistencia","#34D399"],["14","Días activos","#F59E0B"]].map(([v,l,c]) => (
                  <div key={l}><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 9, color: "#3E4C63", marginTop: 1 }}>{l}</div></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== CHAT ===== */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 150px)" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
              {chatMsgs.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line",
                    background: msg.role === "user" ? "#1D4ED8" : "rgba(255,255,255,0.035)",
                    border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.05)" : "none",
                    color: msg.role === "user" ? "#fff" : "#B0BDD0",
                    borderBottomRightRadius: msg.role === "user" ? 4 : 14,
                    borderBottomLeftRadius: msg.role === "ai" ? 4 : 14,
                  }}>
                    {msg.role === "ai" && <div style={{ fontSize: 9, color: "#60A5FA", fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>🤖 ASISTENTE</div>}
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
                  <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, borderBottomLeftRadius: 4, padding: "12px 18px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "#3E4C63", animation: `pulse 1s ease-in-out ${i*0.15}s infinite` }} />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 6 }}>
              {["¿Mejor día para quedar?", "¿Qué tiempo hará?", "Sugiéreme una ruta"].map(s => (
                <button key={s} onClick={() => setChatInput(s)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "5px 10px", color: "#4B5C75", fontSize: 11, cursor: "pointer" }}>{s}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, paddingBottom: 4 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Pregúntame lo que quieras..." style={{ ...S.input, flex: 1, borderRadius: 18, padding: "9px 14px", fontSize: 13 }} />
              <button onClick={sendChat} style={{ ...S.btn(true), borderRadius: 18, padding: "9px 16px", fontSize: 13 }}>↑</button>
            </div>
          </div>
        )}
      </div>

      {/* AVAIL MODAL */}
      {showAvailModal && (
        <div style={S.modal} onClick={() => setShowAvailModal(false)}>
          <div style={S.modalInner} onClick={e => e.stopPropagation()}>
            <div style={{ width: 32, height: 3, borderRadius: 2, background: "#1E293B", margin: "0 auto 14px" }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#F1F5F9", margin: "0 0 2px" }}>Disponibilidad</h3>
            <p style={{ fontSize: 12, color: "#4B5C75", margin: "0 0 14px" }}>
              {selDay?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {[["day","Día completo"],["slots","Franja"],["range","De hora a hora"]].map(([k,l]) => (
                <button key={k} onClick={() => setAvailForm(f => ({...f, type: k}))} style={{
                  flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: availForm.type === k ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.025)",
                  color: availForm.type === k ? "#60A5FA" : "#4B5C75",
                  border: `1px solid ${availForm.type === k ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.05)"}`,
                }}>{l}</button>
              ))}
            </div>
            {availForm.type === "slots" && (
              <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                {SLOTS.map(s => (
                  <button key={s} onClick={() => setAvailForm(f => ({ ...f, slots: f.slots.includes(s) ? f.slots.filter(x=>x!==s) : [...f.slots, s] }))} style={{
                    flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: availForm.slots.includes(s) ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.025)",
                    color: availForm.slots.includes(s) ? "#60A5FA" : "#4B5C75",
                    border: `1px solid ${availForm.slots.includes(s) ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.05)"}`,
                  }}>
                    {s}<div style={{ fontSize: 9, color: "#3E4C63", marginTop: 2 }}>{SLOT_HOURS[s]}</div>
                  </button>
                ))}
              </div>
            )}
            {availForm.type === "range" && (
              <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: "#3E4C63", marginBottom: 3, display: "block" }}>Desde</label>
                  <select value={availForm.fromH} onChange={e => setAvailForm(f => ({...f, fromH: e.target.value}))} style={{ ...S.input, padding: 9 }}>
                    {Array.from({length:24}, (_,i) => <option key={i} value={String(i)}>{String(i).padStart(2,"0")}:00</option>)}
                  </select>
                </div>
                <span style={{ color: "#3E4C63", marginTop: 14 }}>→</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: "#3E4C63", marginBottom: 3, display: "block" }}>Hasta</label>
                  <select value={availForm.toH} onChange={e => setAvailForm(f => ({...f, toH: e.target.value}))} style={{ ...S.input, padding: 9 }}>
                    {Array.from({length:24}, (_,i) => <option key={i} value={String(i)}>{String(i).padStart(2,"0")}:00</option>)}
                  </select>
                </div>
              </div>
            )}
            <button onClick={saveAvail} style={{ ...S.btn(true), width: "100%", padding: "12px", fontSize: 14, marginBottom: 6 }}>Guardar</button>
            {avail[currentUser]?.[selDay && dKey(selDay)] && (
              <button onClick={removeAvail} style={{ ...S.btn(false), width: "100%", padding: "10px", fontSize: 12, color: "#FB7185", borderColor: "rgba(251,113,133,0.15)" }}>Eliminar</button>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={S.modal} onClick={() => setShowCreateModal(false)}>
          <div style={S.modalInner} onClick={e => e.stopPropagation()}>
            <div style={{ width: 32, height: 3, borderRadius: 2, background: "#1E293B", margin: "0 auto 14px" }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#F1F5F9", margin: "0 0 2px" }}>Nueva quedada</h3>
            <p style={{ fontSize: 12, color: "#4B5C75", margin: "0 0 14px" }}>
              {selDay?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {getAvailMembers(selDay).length} disponibles
            </p>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: "#3E4C63", marginBottom: 3, display: "block" }}>Título</label>
              <input value={newQ.title} onChange={e => setNewQ(q => ({...q, title: e.target.value}))} placeholder="Ruta, cena, cine..." style={S.input} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: "#3E4C63", marginBottom: 3, display: "block" }}>Lugar</label>
              <input value={newQ.location} onChange={e => setNewQ(q => ({...q, location: e.target.value}))} placeholder="Monachil, centro..." style={S.input} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#3E4C63", marginBottom: 3, display: "block" }}>Hora</label>
              <input value={newQ.time} onChange={e => setNewQ(q => ({...q, time: e.target.value}))} placeholder="10:00" style={S.input} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: "#3E4C63", marginBottom: 5, display: "block" }}>Asistentes</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {getAvailMembers(selDay).map(m => (
                  <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: "3px 9px 3px 3px" }}>
                    <Avatar member={m.name} size={20} />
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={createQuedada} style={{ ...S.btn(true), width: "100%", padding: "12px", fontSize: 14 }}>Crear quedada</button>
          </div>
        </div>
      )}

      {/* TAB BAR */}
      <div style={S.tabBar}>
        {[["calendar","Calendario"],["plans","Quedadas"],["group","Grupo"],["chat","Chat IA"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={S.tab(tab === k)}>
            <TabIcon name={k} active={tab === k} />
            <span>{l}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
