/* FinanFlow — site estático, com demonstração local e autenticação Supabase.
 * Os lançamentos reais são isolados por usuário com RLS no banco de dados.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
  const shortMoney = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v) || 0);
  const monthLabel = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const dateLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const monthNow = () => dateLocal().slice(0, 7);
  const displayDate = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "—";
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  };
  const categories = {
    expense: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Assinaturas", "Compras", "Contas", "Outros"],
    income: ["Salário", "Freelance", "Investimentos", "Vendas", "Benefícios", "Outras receitas"]
  };
  const icons = { Moradia: "🏠", Alimentação: "🛒", Transporte: "🚗", Saúde: "💊", Educação: "📚", Lazer: "🎉", Assinaturas: "📱", Compras: "🛍️", Contas: "🧾", Outros: "📦", Salário: "💼", Freelance: "💻", Investimentos: "📈", Vendas: "💰", Benefícios: "🎁", "Outras receitas": "💸" };
  const categoryColors = ["#8075ed", "#36b8c0", "#ed9f61", "#e9759a", "#5a97e5", "#b18ae4", "#77b895", "#dc8e78", "#a8a6d3", "#c5a569"];
  const config = window.FINANFLOW_CONFIG || {};
  const isConfigured = typeof config.supabaseUrl === "string" && /^https:\/\//.test(config.supabaseUrl) && typeof config.supabaseKey === "string" && config.supabaseKey.length > 20;
  const DEMO_KEY = "finanflow_demo_entries_v1";
  const state = { mode: null, user: null, client: null, month: monthNow(), rows: [], filter: "all", search: "", editing: null, request: 0, reportBlob: null, reportURL: null, toastTimer: null, recovering: false };

  function toast(message, type = "") {
    const el = $("toast");
    el.textContent = message;
    el.className = `toast show ${type}`;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("show"), 3900);
  }
  function authAlert(message, success = false) {
    const el = $("auth-alert");
    el.textContent = message;
    el.className = `auth-alert${success ? " ok" : ""}`;
  }
  function hideAuthAlert() { $("auth-alert").classList.add("hidden"); }
  function safeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }
  const svg = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  function nextMonth(month, n) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function seededEntries() {
    const month = monthNow();
    const make = (title, kind, category, amount, day, paid, note = "") => ({
      id: `demo-${Math.random().toString(36).slice(2, 12)}`, title, kind, category,
      amount, due_date: `${month}-${String(day).padStart(2, "0")}`, paid, note,
      created_at: new Date().toISOString()
    });
    return [
      make("Salário mensal", "income", "Salário", 4800, 5, true),
      make("Projeto freelancer", "income", "Freelance", 950, 25, false),
      make("Aluguel do apartamento", "expense", "Moradia", 1450, 8, true),
      make("Energia elétrica", "expense", "Contas", 219.80, 17, false),
      make("Internet residencial", "expense", "Contas", 119.90, 20, false),
      make("Compras de supermercado", "expense", "Alimentação", 560.45, 12, true),
      make("Fatura do cartão", "expense", "Compras", 789.70, 28, false),
      make("Gasolina", "expense", "Transporte", 280, 18, true),
      make("Streaming", "expense", "Assinaturas", 55.90, 23, false)
    ];
  }
  function readDemo() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { console.warn("Demonstração: armazenamento indisponível", e); }
    const seeded = seededEntries();
    writeDemo(seeded);
    return seeded;
  }
  function writeDemo(rows) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); }
    catch (e) { toast("Seu navegador bloqueou o armazenamento local.", "error"); }
  }
  function showAuth() {
    state.mode = null; state.user = null; state.rows = [];
    $("app-screen").classList.add("hidden");
    $("auth-screen").classList.remove("hidden");
    closeSidebar();
    for (const el of document.querySelectorAll("dialog[open]")) el.close();
  }
  function activate(mode, user) {
    state.mode = mode; state.user = user;
    state.month = monthNow(); state.search = ""; state.filter = "all";
    $("search-input").value = ""; $("status-filter").value = "all";
    $("auth-screen").classList.add("hidden");
    $("app-screen").classList.remove("hidden");
    $("demo-banner").classList.toggle("hidden", mode !== "demo");
    const email = mode === "demo" ? "Modo demonstração" : (user?.email || "Usuário");
    const display = mode === "demo" ? "Visitante" : email.split("@")[0].replace(/[._-]+/g, " ");
    const initial = display.charAt(0).toUpperCase();
    $("account-name").textContent = display.charAt(0).toUpperCase() + display.slice(1);
    $("account-email").textContent = email;
    $("account-avatar").textContent = initial;
    $("top-avatar").textContent = initial;
    $("connection-label").textContent = mode === "demo" ? "Dados neste navegador" : "Dados sincronizados";
    void loadEntries();
  }
  function setAuthMode(mode) {
    const registering = mode === "signup";
    $("auth-form").dataset.mode = mode;
    $("auth-title").textContent = registering ? "Crie sua conta" : "Acesse sua conta";
    $("auth-description").textContent = registering ? "Comece hoje a organizar suas finanças." : "Entre para continuar de onde você parou.";
    $("auth-submit").innerHTML = registering ? "Criar minha conta <span>→</span>" : "Entrar na minha conta <span>→</span>";
    $("auth-switch-label").textContent = registering ? "Já tem uma conta?" : "Ainda não tem uma conta?";
    $("auth-switch-btn").textContent = registering ? "Fazer login" : "Criar conta gratuita";
    $("forgot-password").classList.toggle("hidden", registering);
    $("auth-password").autocomplete = registering ? "new-password" : "current-password";
    hideAuthAlert();
  }
  function translateError(error) {
    const m = String(error?.message || error || "Erro desconhecido");
    if (/invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar. Verifique também o spam.";
    if (/user already registered/i.test(m)) return "Este e-mail já possui uma conta.";
    if (/password should be at least/i.test(m)) return "A senha é muito curta. Use pelo menos 6 caracteres.";
    if (/rate limit|too many requests/i.test(m)) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    if (/failed to fetch|network|networkerror/i.test(m)) return "Não foi possível conectar. Verifique a internet e a configuração do Supabase.";
    if (/relation.*entries|schema cache|could not find the table/i.test(m)) return "Tabela não encontrada. Execute o arquivo supabase.sql no Supabase.";
    return m;
  }
  async function submitAuth(event) {
    event.preventDefault();
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    if (!isConfigured) return authAlert("Para usar login real, configure a URL e a chave pública do Supabase no arquivo config.js. Você já pode testar a demonstração.");
    if (!state.client) return authAlert("Não foi possível carregar a biblioteca do Supabase. Verifique sua conexão.");
    const mode = $("auth-form").dataset.mode || "login";
    const submit = $("auth-submit"); submit.disabled = true;
    hideAuthAlert();
    try {
      if (mode === "signup") {
        const { data, error } = await state.client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
        if (data.session) activate("cloud", data.user);
        else authAlert("Cadastro solicitado! Confira seu e-mail e confirme o endereço para ativar sua conta.", true);
      } else {
        const { data, error } = await state.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) activate("cloud", data.user);
      }
    } catch (error) { authAlert(translateError(error)); }
    finally { submit.disabled = false; }
  }
  async function forgotPassword() {
    if (!isConfigured || !state.client) return authAlert("Configure o Supabase para recuperar senhas.");
    const email = $("auth-email").value.trim();
    if (!email || !$("auth-email").checkValidity()) return authAlert("Digite seu e-mail no campo acima para receber o link de recuperação.");
    try {
      const { error } = await state.client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (error) throw error;
      authAlert("Se o e-mail estiver cadastrado, você receberá um link para criar outra senha.", true);
    } catch (error) { authAlert(translateError(error)); }
  }
  async function savePassword(event) {
    event.preventDefault();
    if (!state.client) return;
    const password = $("new-password").value;
    try {
      const { error } = await state.client.auth.updateUser({ password });
      if (error) throw error;
      $("password-dialog").close();
      $("password-form").reset();
      toast("Senha alterada com sucesso!", "success");
    } catch (error) { toast(translateError(error), "error"); }
  }
  async function logout() {
    if (state.mode === "cloud" && state.client) {
      const { error } = await state.client.auth.signOut();
      if (error) { toast(translateError(error), "error"); return; }
    }
    showAuth();
  }
  async function loadEntries() {
    const myRequest = ++state.request;
    const month = state.month;
    $("current-month").textContent = monthLabel(month);
    if (state.mode === "demo") {
      state.rows = readDemo().filter((row) => String(row.due_date || "").slice(0, 7) === month).sort((a, b) => a.due_date.localeCompare(b.due_date));
      renderAll(); return;
    }
    if (state.mode !== "cloud" || !state.client || !state.user) return;
    const accountID = state.user.id;
    try {
      const { data, error } = await state.client.from("entries").select("id,user_id,title,kind,category,amount,due_date,paid,note,created_at")
        .eq("user_id", accountID).gte("due_date", `${month}-01`).lt("due_date", `${nextMonth(month, 1)}-01`).order("due_date", { ascending: true });
      if (error) throw error;
      if (myRequest !== state.request || state.mode !== "cloud" || accountID !== state.user?.id) return;
      state.rows = data || [];
      renderAll();
    } catch (error) {
      if (myRequest !== state.request) return;
      state.rows = [];
      renderAll();
      toast(translateError(error), "error");
    }
  }
  function totals() {
    const rows = state.rows;
    const sum = (items) => items.reduce((a, x) => a + Number(x.amount || 0), 0);
    const income = sum(rows.filter((r) => r.kind === "income"));
    const expenses = sum(rows.filter((r) => r.kind === "expense"));
    const pendingRows = rows.filter((r) => r.kind === "expense" && !r.paid);
    return { income, expenses, pendingRows, pending: sum(pendingRows) };
  }
  function renderAll() {
    const s = totals();
    $("stat-income").textContent = money(s.income);
    $("stat-expenses").textContent = money(s.expenses);
    $("stat-pending").textContent = money(s.pending);
    $("stat-balance").textContent = money(s.income - s.expenses);
    $("stat-pending-count").textContent = `${s.pendingRows.length} ${s.pendingRows.length === 1 ? "conta aguardando" : "contas aguardando"} pagamento`;
    $("footer-pending").textContent = `Total pendente: ${money(s.pending)}`;
    renderCategories(); renderTable();
  }
  function renderCategories() {
    const root = $("category-chart"); root.replaceChildren();
    const byCat = new Map();
    for (const row of state.rows) {
      if (row.kind !== "expense") continue;
      byCat.set(row.category, (byCat.get(row.category) || 0) + Number(row.amount));
    }
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!sorted.length) {
      const p = document.createElement("p"); p.className = "empty-subtle";
      p.textContent = "Cadastre despesas para visualizar suas categorias.";
      root.append(p); return;
    }
    const max = sorted[0][1];
    sorted.forEach(([category, value], i) => {
      const row = document.createElement("div"); row.className = "cat-row";
      const name = document.createElement("div"); name.className = "cat-name";
      const swatch = document.createElement("span"); swatch.className = "cat-swatch"; swatch.style.background = categoryColors[i];
      const label = document.createElement("span"); label.textContent = category;
      name.append(swatch, label);
      const track = document.createElement("div"); track.className = "cat-track";
      const fill = document.createElement("div"); fill.className = "cat-fill";
      fill.style.background = categoryColors[i]; fill.style.width = `${100 * value / max}%`;
      track.append(fill);
      const sum = document.createElement("div"); sum.className = "cat-value"; sum.textContent = shortMoney(value);
      row.append(name, track, sum); root.append(row);
    });
  }
  function filteredRows() {
    const search = state.search.toLocaleLowerCase("pt-BR");
    return state.rows.filter((row) => {
      if (search && !`${row.title} ${row.category} ${row.note || ""}`.toLocaleLowerCase("pt-BR").includes(search)) return false;
      switch (state.filter) {
        case "pending": return row.kind === "expense" && !row.paid;
        case "paid": return row.kind === "expense" && row.paid;
        case "income": return row.kind === "income";
        case "expense": return row.kind === "expense";
        default: return true;
      }
    });
  }
  function renderTable() {
    const tbody = $("transactions-body");
    const rows = filteredRows();
    const today = dateLocal();
    tbody.innerHTML = rows.map((r) => {
      const income = r.kind === "income";
      const overdue = !r.paid && !income && r.due_date < today;
      const status = r.paid ? (income ? "Recebida" : "Paga") : (income ? "A receber" : overdue ? "Vencida" : "Pendente");
      const cls = r.paid ? "is-done" : overdue ? "is-overdue" : "is-pending";
      return `<tr>
        <td><div class="transaction-name"><div class="mini-icon" style="background:${income ? "#e4f8f1" : "#f1efff"}">${icons[r.category] || "🧾"}</div><div><strong>${safeHTML(r.title)}</strong><small>${safeHTML(r.category)}${r.note ? ` · ${safeHTML(r.note)}` : ""}</small></div></div></td>
        <td>${displayDate(r.due_date)}</td><td class="${income ? "amount-income" : ""}">${income ? "+ " : "− "}${money(r.amount)}</td>
        <td><button type="button" class="status-badge ${cls}" data-action="toggle" data-id="${safeHTML(r.id)}" title="Clique para alterar o status">${status}</button></td>
        <td><div class="action-buttons"><button class="icon-btn" type="button" data-action="edit" data-id="${safeHTML(r.id)}" aria-label="Editar ${safeHTML(r.title)}" title="Editar">${svg("edit")}</button><button class="icon-btn" type="button" data-action="delete" data-id="${safeHTML(r.id)}" aria-label="Excluir ${safeHTML(r.title)}" title="Excluir">${svg("trash")}</button></div></td>
      </tr>`;
    }).join("");
    $("empty-state").classList.toggle("hidden", rows.length > 0);
    $("table-count").textContent = `${rows.length} ${rows.length === 1 ? "lançamento" : "lançamentos"}`;
  }
  function fillCategories(selected) {
    const kind = $("item-kind").value;
    const el = $("item-category");
    el.replaceChildren();
    for (const category of categories[kind]) {
      const option = document.createElement("option"); option.value = category; option.textContent = category; el.append(option);
    }
    if (selected && categories[kind].includes(selected)) el.value = selected;
    $("item-paid-label").textContent = kind === "income" ? "Essa receita já foi recebida" : "Essa despesa já foi paga";
  }
  function openEditor(entry = null) {
    state.editing = entry?.id || null;
    $("transaction-form").reset();
    $("transaction-dialog-title").textContent = entry ? "Editar lançamento" : "Novo lançamento";
    $("item-kind").value = entry?.kind || "expense";
    fillCategories(entry?.category);
    $("item-name").value = entry?.title || "";
    $("item-amount").value = entry ? Number(entry.amount).toFixed(2).replace(".", ",") : "";
    $("item-due").value = entry?.due_date || `${state.month}-${dateLocal().slice(-2)}`;
    if (!entry) {
      const [y, m] = state.month.split("-").map(Number);
      const todayDay = new Date().getDate();
      $("item-due").value = dateLocal(new Date(y, m - 1, Math.min(todayDay, new Date(y, m, 0).getDate())));
    }
    $("item-paid").checked = Boolean(entry?.paid);
    $("item-note").value = entry?.note || "";
    $("transaction-dialog").showModal();
    $("item-name").focus();
  }
  function parseAmount(text) {
    const raw = String(text).trim().replace(/\s|R\$/g, "");
    if (!/^\d{1,12}([.,]\d{1,2})?$/.test(raw) && !/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) return NaN;
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
    return Number(normalized);
  }
  async function saveEntry(event) {
    event.preventDefault();
    const value = parseAmount($("item-amount").value);
    if (!Number.isFinite(value) || value <= 0 || value > 9999999999.99) return toast("Informe um valor válido. Ex.: 150,90", "error");
    const kind = $("item-kind").value;
    const category = $("item-category").value;
    if (!categories[kind]?.includes(category)) return toast("Selecione uma categoria válida.", "error");
    const title = $("item-name").value.trim();
    const due_date = $("item-due").value;
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) return toast("Preencha a descrição e a data.", "error");
    const payload = { title, amount: value, kind, category, due_date, paid: $("item-paid").checked, note: $("item-note").value.trim() };
    const submit = $("item-save"); submit.disabled = true;
    try {
      if (state.mode === "demo") {
        const all = readDemo();
        if (state.editing) {
          const index = all.findIndex((item) => item.id === state.editing);
          if (index < 0) throw Error("Registro não encontrado.");
          all[index] = { ...all[index], ...payload };
        } else all.push({ id: `demo-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`, created_at: new Date().toISOString(), ...payload });
        writeDemo(all);
      } else {
        if (!state.user) throw Error("Sessão expirada. Entre novamente.");
        if (state.editing) {
          const { data, error } = await state.client.from("entries").update(payload).eq("id", state.editing).eq("user_id", state.user.id).select("id");
          if (error) throw error;
          if (!data?.length) throw Error("Não foi possível atualizar este lançamento.");
        } else {
          const { error } = await state.client.from("entries").insert({ ...payload, user_id: state.user.id });
          if (error) throw error;
        }
      }
      $("transaction-dialog").close();
      state.month = due_date.slice(0, 7);
      await loadEntries();
      toast("Lançamento salvo com sucesso!", "success");
    } catch (error) { toast(translateError(error), "error"); }
    finally { submit.disabled = false; }
  }
  async function togglePaid(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row) return;
    const updated = !row.paid;
    try {
      if (state.mode === "demo") {
        writeDemo(readDemo().map((item) => item.id === id ? { ...item, paid: updated } : item));
      } else {
        const { data, error } = await state.client.from("entries").update({ paid: updated }).eq("id", id).eq("user_id", state.user.id).select("id");
        if (error) throw error;
        if (!data?.length) throw Error("Registro não encontrado.");
      }
      await loadEntries(); toast(updated ? "Marcado como pago / recebido." : "Marcado como pendente.", "success");
    } catch (error) { toast(translateError(error), "error"); }
  }
  async function removeEntry(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row || !window.confirm(`Excluir o lançamento “${row.title}”? Essa ação não pode ser desfeita.`)) return;
    try {
      if (state.mode === "demo") writeDemo(readDemo().filter((r) => r.id !== id));
      else {
        const { data, error } = await state.client.from("entries").delete().eq("id", id).eq("user_id", state.user.id).select("id");
        if (error) throw error;
        if (!data?.length) throw Error("Registro não encontrado.");
      }
      await loadEntries(); toast("Lançamento excluído.", "success");
    } catch (error) { toast(translateError(error), "error"); }
  }
  function onTableAction(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const row = state.rows.find((item) => item.id === btn.dataset.id);
    if (!row) return;
    if (btn.dataset.action === "edit") openEditor(row);
    if (btn.dataset.action === "toggle") void togglePaid(row.id);
    if (btn.dataset.action === "delete") void removeEntry(row.id);
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function csvCell(value) {
    let v = String(value ?? "").replace(/\r?\n/g, " ");
    if (/^[\s]*[=+\-@\t\r]/.test(v)) v = "'" + v; // impede execução de fórmulas em planilhas
    return `"${v.replace(/"/g, '""')}"`;
  }
  function exportCSV() {
    const columns = ["Tipo", "Descrição", "Categoria", "Valor (R$)", "Data", "Status", "Observação"];
    const lines = [columns, ...state.rows.map((r) => [r.kind === "income" ? "Receita" : "Despesa", r.title, r.category, Number(r.amount).toFixed(2).replace(".", ","), displayDate(r.due_date), r.paid ? "Pago/recebido" : "Pendente", r.note || ""])];
    const csv = "\uFEFF" + lines.map((row) => row.map(csvCell).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `finanflow-${state.month}.csv`);
    toast("Planilha CSV exportada.", "success");
  }
  function roundRect(ctx, x, y, w, h, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  }
  function clippedText(ctx, text, maxWidth) {
    let str = String(text ?? "");
    while (str.length && ctx.measureText(str).width > maxWidth) str = str.slice(0, -1);
    return str === String(text ?? "") ? str : str.trimEnd() + "…";
  }
  function makeReportCanvas() {
    const unpaid = totals().pendingRows.slice().sort((a, b) => a.due_date.localeCompare(b.due_date));
    const count = unpaid.length;
    const chunk = 65; // divide listas grandes em colunas, mantendo tudo em um PNG
    const cols = Math.max(1, Math.ceil(count / chunk));
    const itemsPerCol = Math.max(1, Math.ceil(count / cols));
    const colW = 940, margin = 44, top = 350, lineH = 79;
    const width = cols * colW + 2 * margin;
    const height = Math.max(680, top + itemsPerCol * lineH + 120);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Seu navegador não suporta gerar imagens Canvas.");
    ctx.fillStyle = "#f5f6fb"; ctx.fillRect(0, 0, width, height);
    roundRect(ctx, 24, 24, width - 48, 276, 26, "#222b59");
    const gradient = ctx.createLinearGradient(width - 500, 40, width, 320);
    gradient.addColorStop(0, "#7d6cf2"); gradient.addColorStop(1, "#392c78");
    ctx.save();
    ctx.beginPath(); ctx.roundRect(24, 24, width - 48, 276, 26); ctx.clip();
    ctx.fillStyle = gradient; ctx.globalAlpha = .43;
    ctx.beginPath(); ctx.arc(width - 100, 30, 280, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#bcb5ff"; ctx.font = "bold 19px sans-serif"; ctx.fillText("FINANFLOW  /  CONTROLE FINANCEIRO", 64, 82);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 42px sans-serif"; ctx.fillText("Contas pendentes", 64, 144);
    ctx.fillStyle = "#e0dfff"; ctx.font = "25px sans-serif"; ctx.fillText(monthLabel(state.month), 64, 187);
    ctx.fillStyle = "#fff"; ctx.font = "bold 43px sans-serif"; ctx.fillText(money(totals().pending), 64, 258);
    const summaryX = Math.min(width - 385, 610);
    ctx.fillStyle = "#e0dbff"; ctx.font = "18px sans-serif"; ctx.fillText(`${count} ${count === 1 ? "conta" : "contas"} a pagar`, summaryX, 248);
    ctx.fillStyle = "#6e7492"; ctx.font = "bold 18px sans-serif";
    ctx.fillText(`DESPESAS NÃO PAGAS  •  ${monthLabel(state.month).toUpperCase()}`, 65, 340);
    if (!count) {
      roundRect(ctx, 44, 381, width - 88, 173, 20, "#ffffff");
      ctx.fillStyle = "#2c9b7d"; ctx.font = "bold 35px sans-serif";
      ctx.fillText("Tudo em dia! Nenhuma conta pendente.", 80, 480);
    }
    const today = dateLocal();
    unpaid.forEach((item, index) => {
      const column = Math.floor(index / itemsPerCol);
      const row = index % itemsPerCol;
      const x = margin + column * colW;
      const y = top + 25 + row * lineH;
      roundRect(ctx, x, y, colW - 14, 67, 12, "#ffffff");
      roundRect(ctx, x + 17, y + 13, 5, 41, 2, item.due_date < today ? "#ef7890" : "#9077f2");
      ctx.fillStyle = "#293454"; ctx.font = "bold 20px sans-serif";
      ctx.fillText(clippedText(ctx, item.title, 475), x + 42, y + 28);
      ctx.fillStyle = "#8590a8"; ctx.font = "15px sans-serif";
      ctx.fillText(`${item.category}  •  ${displayDate(item.due_date)}${item.due_date < today ? "  •  VENCIDA" : ""}`, x + 42, y + 52);
      ctx.fillStyle = "#263253"; ctx.font = "bold 23px sans-serif";
      ctx.textAlign = "right"; ctx.fillText(money(item.amount), x + colW - 42, y + 40); ctx.textAlign = "left";
    });
    ctx.fillStyle = "#8b94ab"; ctx.font = "17px sans-serif";
    ctx.fillText(`Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())} • Apenas despesas pendentes`, 62, height - 47);
    ctx.textAlign = "right"; ctx.fillText("finanflow.", width - 61, height - 47); ctx.textAlign = "left";
    return canvas;
  }
  async function openReport() {
    try {
      const canvas = makeReportCanvas();
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(Error("Não foi possível exportar a imagem.")), "image/png"));
      if (state.reportURL) URL.revokeObjectURL(state.reportURL);
      state.reportBlob = blob;
      state.reportURL = URL.createObjectURL(blob);
      $("report-preview-image").src = state.reportURL;
      $("share-image").classList.toggle("hidden", !(navigator.share && navigator.canShare));
      $("report-dialog").showModal();
    } catch (error) { toast(translateError(error), "error"); }
  }
  function downloadReport() {
    if (!state.reportBlob) return;
    downloadBlob(state.reportBlob, `finanflow-pendentes-${state.month}.png`);
    toast("Imagem PNG baixada!", "success");
  }
  async function shareReport() {
    if (!state.reportBlob) return;
    const file = new File([state.reportBlob], `finanflow-pendentes-${state.month}.png`, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return toast("Compartilhamento de arquivos indisponível neste aparelho. Use Baixar PNG.", "error");
    try { await navigator.share({ title: `Contas pendentes — ${monthLabel(state.month)}`, files: [file] }); }
    catch (e) { if (e.name !== "AbortError") toast("Não foi possível compartilhar. Use Baixar PNG.", "error"); }
  }
  function closeSidebar() { $("sidebar").classList.remove("open"); $("sidebar-overlay").classList.add("hidden"); }
  function attachEvents() {
    $("auth-form").addEventListener("submit", submitAuth);
    $("auth-switch-btn").addEventListener("click", () => setAuthMode($("auth-form").dataset.mode === "signup" ? "login" : "signup"));
    $("forgot-password").addEventListener("click", forgotPassword);
    $("demo-start").addEventListener("click", () => activate("demo", { email: "demo" }));
    $("password-form").addEventListener("submit", savePassword);
    $("logout-btn").addEventListener("click", logout);
    $("prev-month").addEventListener("click", () => { state.month = nextMonth(state.month, -1); void loadEntries(); });
    $("next-month").addEventListener("click", () => { state.month = nextMonth(state.month, 1); void loadEntries(); });
    $("go-today").addEventListener("click", () => { state.month = monthNow(); void loadEntries(); });
    for (const id of ["add-transaction", "empty-add"]) $(id).addEventListener("click", () => openEditor());
    $("item-kind").addEventListener("change", () => fillCategories());
    $("transaction-form").addEventListener("submit", saveEntry);
    $("transactions-body").addEventListener("click", onTableAction);
    $("search-input").addEventListener("input", (e) => { state.search = e.target.value.trim(); renderTable(); });
    $("status-filter").addEventListener("change", (e) => { state.filter = e.target.value; renderTable(); });
    $("export-csv").addEventListener("click", exportCSV);
    for (const id of ["nav-image", "sidebar-report", "big-report"]) $(id).addEventListener("click", () => { closeSidebar(); void openReport(); });
    $("download-image").addEventListener("click", downloadReport);
    $("share-image").addEventListener("click", shareReport);
    for (const btn of document.querySelectorAll("[data-close]")) btn.addEventListener("click", () => $(btn.dataset.close).close());
    for (const dialog of document.querySelectorAll("dialog")) {
      dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    }
    $("menu-open").addEventListener("click", () => { $("sidebar").classList.add("open"); $("sidebar-overlay").classList.remove("hidden"); });
    $("sidebar-close").addEventListener("click", closeSidebar);
    $("sidebar-overlay").addEventListener("click", closeSidebar);
    document.querySelectorAll(".nav-item[href]").forEach((el) => el.addEventListener("click", () => {
      document.querySelectorAll(".nav-item[href]").forEach((item) => item.classList.remove("active"));
      el.classList.add("active"); closeSidebar();
    }));
  }
  async function init() {
    $("footer-year").textContent = String(new Date().getFullYear());
    setAuthMode("login");
    attachEvents();
    if (!isConfigured) return;
    if (!window.supabase?.createClient) return authAlert("O Supabase não pôde ser carregado. Confira sua conexão com a internet.");
    try {
      state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
      state.client.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          state.recovering = true;
          setTimeout(() => { if (!$("password-dialog").open) $("password-dialog").showModal(); }, 0);
        }
        if (event === "SIGNED_OUT" && state.mode === "cloud") setTimeout(showAuth, 0);
        if (event === "SIGNED_IN" && session?.user && state.mode !== "cloud") {
          setTimeout(() => { if (state.mode === null) activate("cloud", session.user); }, 0);
        }
      });
      const { data, error } = await state.client.auth.getSession();
      if (error) throw error;
      if (data.session?.user && state.mode === null) activate("cloud", data.session.user);
    } catch (error) { authAlert(translateError(error)); }
  }
  void init();
})();
