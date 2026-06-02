import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, PencilLine, Plus, RefreshCw, Trash2, UserRound, XCircle } from "lucide-react";
import { useApi } from "../lib/api";

const EMPTY_FORM = {
  name: "",
  birthDate: "",
  cpf: "",
  pixKey: "",
  bankName: "",
  active: true,
  notes: "",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function mapToForm(collaborator) {
  return {
    name: collaborator?.name || "",
    birthDate: collaborator?.birthDate ? collaborator.birthDate.slice(0, 10) : "",
    cpf: collaborator?.cpf || "",
    pixKey: collaborator?.pixKey || "",
    bankName: collaborator?.bankName || "",
    active: collaborator?.active !== false,
    notes: collaborator?.notes || "",
  };
}

function buildPayload(form) {
  return {
    name: form.name.trim(),
    birthDate: form.birthDate || null,
    cpf: form.cpf.trim() || null,
    pixKey: form.pixKey.trim() || null,
    bankName: form.bankName.trim() || null,
    active: Boolean(form.active),
    notes: form.notes.trim() || null,
  };
}

export default function MaintenanceCollaborators() {
  const api = useApi();
  const [collaborators, setCollaborators] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");

  const activeCount = useMemo(
    () => collaborators.filter((collaborator) => collaborator.active !== false).length,
    [collaborators]
  );

  const loadCollaborators = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api("/maintenance-collaborators?includeInactive=1");
      setCollaborators(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error("Erro ao carregar colaboradores:", err);
      alert(err?.message || "Erro ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = buildPayload(form);

    if (!payload.name) {
      alert("Informe o nome do colaborador.");
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await api(`/maintenance-collaborators/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/maintenance-collaborators", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await loadCollaborators();
    } catch (err) {
      console.error("Erro ao salvar colaborador:", err);
      alert(err?.message || "Erro ao salvar colaborador.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (collaborator) => {
    setEditingId(collaborator.id);
    setForm(mapToForm(collaborator));
  };

  const handleDelete = async (collaborator) => {
    if (!window.confirm(`Remover o colaborador "${collaborator.name}"?`)) return;

    try {
      setRemovingId(collaborator.id);
      await api(`/maintenance-collaborators/${collaborator.id}`, { method: "DELETE" });
      if (editingId === collaborator.id) resetForm();
      await loadCollaborators();
    } catch (err) {
      console.error("Erro ao remover colaborador:", err);
      alert(err?.message || "Erro ao remover colaborador.");
    } finally {
      setRemovingId("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.03em]">Colaboradores de manutencao</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Cadastre quem pode ser designado nas atividades do calendario de manutencao.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <UserRound className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ativos</div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">{activeCount}</div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome *</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nascimento</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CPF</label>
              <input
                value={form.cpf}
                onChange={(event) => setForm((current) => ({ ...current, cpf: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Chave Pix</label>
              <input
                value={form.pixKey}
                onChange={(event) => setForm((current) => ({ ...current, pixKey: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Banco</label>
              <input
                value={form.bankName}
                onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Observacoes</label>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <label className="mt-7 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4"
              />
              Colaborador ativo
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <button
              type="button"
              onClick={loadCollaborators}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>

            <div className="flex flex-wrap gap-3">
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancelar edicao
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Cadastrar"}
              </button>
            </div>
          </div>
        </form>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Nascimento</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Pix</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {collaborators.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-slate-400">
                      {loading ? "Carregando colaboradores..." : "Nenhum colaborador cadastrado."}
                    </td>
                  </tr>
                ) : (
                  collaborators.map((collaborator) => (
                    <tr key={collaborator.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{collaborator.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(collaborator.birthDate)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{collaborator.cpf || "-"}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{collaborator.pixKey || "-"}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{collaborator.bankName || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          collaborator.active !== false
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {collaborator.active !== false ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {collaborator.active !== false ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(collaborator)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(collaborator)}
                            disabled={removingId === collaborator.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {removingId === collaborator.id ? "Removendo" : "Remover"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
