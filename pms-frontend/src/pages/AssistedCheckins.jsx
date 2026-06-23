import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { CalendarClock, CheckCircle2, FileCheck2, KeyRound, MessageSquareText, RefreshCw } from "lucide-react";
import { useApi } from "../lib/api";

const STATUS_LABELS = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  pronto_para_entrega: "Pronto para entrega",
  concluido: "Concluido",
};

const DEFAULT_RULES_MESSAGE = `*Regras do Condomínio - Informações Importantes*

Prezados(as),

Para garantir a boa convivência e o cumprimento das normas do condomínio, pedimos a gentileza de observar atentamente as orientações abaixo:

*1. Entrada e saída com malas*
A entrada e saída com malas devem ser feitas exclusivamente pela lateral do prédio (entrada de pedestres).
*Não é permitido utilizar a entrada social para esse fim.*

⚠️ *Atenção:* o não cumprimento dessa regra está sujeito à multa conforme as normas do condomínio.

*2. Localização da lixeira do condomínio*
A lixeira está localizada no acesso lateral interno. Para encontrá-la, siga as instruções abaixo:

- De frente para os elevadores, siga pela saída para a área externa;
- Logo à direita, no meio do corredor, encontram-se as lixeiras para descarte de lixo;
- Seguindo um pouco mais à frente e virando à direita, há um corredor que dá acesso direto à saída lateral para a rua.

*3. Acesso pela porta lateral*
A saída lateral possui uma porta de acesso controlado:

- Para entrar no condomínio (da rua para dentro), é necessário utilizar a TAG;
- Para sair do condomínio (de dentro para a rua), há um botão/interruptor sinalizado ao lado da porta, que realiza a abertura automática.

Em caso de dúvidas, estou à disposição para ajudar.

Agradecemos a compreensão e a colaboração de todos.`;

function statusTone(status) {
  if (status === "concluido") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (status === "pronto_para_entrega") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200";
  if (status === "em_andamento") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
}

function formatDate(value) {
  if (!value) return "-";
  return dayjs(value).format("DD/MM/YYYY");
}

function formatDateTime(value) {
  if (!value) return "-";
  return dayjs(value).format("DD/MM/YYYY HH:mm");
}

function toDateTimeLocal(value) {
  if (!value) return "";
  return dayjs(value).format("YYYY-MM-DDTHH:mm");
}

function fromDateTimeLocal(value) {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toISOString() : null;
}

function getAssisted(reservation) {
  return reservation.assistedCheckin || {
    status: "pendente",
    scheduledArrivalAt: null,
    rulesMessageSentAt: null,
    documentsReceivedAt: null,
    keyDeliveryConfirmedAt: null,
    notes: "",
  };
}

function StepButton({ icon: Icon, label, value, onToggle, disabled }) {
  const done = Boolean(value);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex min-h-[72px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:opacity-60 ${
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
      }`}
    >
      <Icon size={20} className="shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {done ? formatDateTime(value) : "Pendente"}
        </span>
      </span>
    </button>
  );
}

export default function AssistedCheckins() {
  const api = useApi();
  const [from, setFrom] = useState(dayjs().subtract(2, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().add(14, "day").format("YYYY-MM-DD"));
  const [reservations, setReservations] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/assisted-checkins?from=${from}&to=${to}`);
      setReservations(Array.isArray(data) ? data : []);
      setDrafts((prev) => {
        const next = { ...prev };
        (Array.isArray(data) ? data : []).forEach((reservation) => {
          const assisted = getAssisted(reservation);
          next[reservation.id] = {
            scheduledArrivalAt: toDateTimeLocal(assisted.scheduledArrivalAt),
            rulesMessageText: assisted.rulesMessageText || DEFAULT_RULES_MESSAGE,
            notes: assisted.notes || "",
          };
        });
        return next;
      });
    } catch (err) {
      console.error("Erro ao carregar check-ins presenciais:", err);
      setError(err?.message || "Erro ao carregar check-ins presenciais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    return reservations.reduce(
      (acc, reservation) => {
        const status = getAssisted(reservation).status || "pendente";
        acc.total += 1;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [reservations]);

  const updateLocalAssisted = (reservationId, assistedCheckin) => {
    setReservations((prev) =>
      prev.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, assistedCheckin }
          : reservation
      )
    );
  };

  const saveFields = async (reservation, fields) => {
    setSavingId(reservation.id);
    setError("");
    try {
      const updated = await api(`/assisted-checkins/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify(fields),
      });
      updateLocalAssisted(reservation.id, updated);
      setDrafts((prev) => ({
        ...prev,
          [reservation.id]: {
            scheduledArrivalAt: toDateTimeLocal(updated.scheduledArrivalAt),
            rulesMessageText: updated.rulesMessageText || DEFAULT_RULES_MESSAGE,
            notes: updated.notes || "",
          },
        }));
      if (updated.reservationStatus) {
        setReservations((prev) =>
          prev.map((item) =>
            item.id === reservation.id ? { ...item, status: updated.reservationStatus } : item
          )
        );
      }
    } catch (err) {
      console.error("Erro ao salvar check-in presencial:", err);
      setError(err?.message || "Erro ao salvar check-in presencial.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleTimestamp = (reservation, field) => {
    const assisted = getAssisted(reservation);
    saveFields(reservation, {
      [field]: assisted[field] ? null : new Date().toISOString(),
    });
  };

  const saveDraft = (reservation) => {
    const draft = drafts[reservation.id] || {};
    saveFields(reservation, {
      scheduledArrivalAt: fromDateTimeLocal(draft.scheduledArrivalAt),
      rulesMessageText: draft.rulesMessageText || DEFAULT_RULES_MESSAGE,
      notes: draft.notes || null,
    });
  };

  const copyRulesMessage = async (reservation) => {
    const draft = drafts[reservation.id] || {};
    const text = draft.rulesMessageText || DEFAULT_RULES_MESSAGE;
    await navigator.clipboard.writeText(text);
  };

  const confirmRulesSent = (reservation) => {
    const draft = drafts[reservation.id] || {};
    saveFields(reservation, {
      rulesMessageText: draft.rulesMessageText || DEFAULT_RULES_MESSAGE,
      rulesMessageSentAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check-ins presenciais</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Reservas de unidades que exigem combinacao de horario e entrega de chaves.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr,1fr,auto]">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          De
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Ate
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="self-end rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
        >
          Filtrar
        </button>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total", summary.total],
          ["Pendentes", summary.pendente || 0],
          ["Em andamento", summary.em_andamento || 0],
          ["Prontos", summary.pronto_para_entrega || 0],
          ["Check-ins realizados", summary.concluido || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
          </div>
        ))}
      </section>

      {error ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Carregando check-ins presenciais...
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Nenhuma reserva presencial nesta janela.
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((reservation) => {
            const assisted = getAssisted(reservation);
            const draft = drafts[reservation.id] || {};
            const saving = savingId === reservation.id;

            return (
              <article key={reservation.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {reservation.room?.stay?.name || "Sem empreendimento"}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold">
                      {reservation.guest?.name || "Hospede sem nome"}
                    </h2>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {reservation.room?.title || "Sem unidade"} - entrada {formatDate(reservation.checkinDate)} - saida {formatDate(reservation.checkoutDate)}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(assisted.status)}`}>
                    {STATUS_LABELS[assisted.status] || assisted.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Horario combinado de chegada
                      <input
                        type="datetime-local"
                        value={draft.scheduledArrivalAt || ""}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [reservation.id]: {
                              ...(prev[reservation.id] || {}),
                              scheduledArrivalAt: event.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Modelo WhatsApp - regras do condominio
                      <textarea
                        value={draft.rulesMessageText || DEFAULT_RULES_MESSAGE}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [reservation.id]: {
                              ...(prev[reservation.id] || {}),
                              rulesMessageText: event.target.value,
                            },
                          }))
                        }
                        rows={12}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyRulesMessage(reservation)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        Copiar mensagem
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRulesSent(reservation)}
                        disabled={saving}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                      >
                        Confirmar envio das regras
                      </button>
                    </div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Observacoes
                      <textarea
                        value={draft.notes || ""}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [reservation.id]: {
                              ...(prev[reservation.id] || {}),
                              notes: event.target.value,
                            },
                          }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveDraft(reservation)}
                      disabled={saving}
                      className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : "Salvar horario e observacoes"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <StepButton
                      icon={CalendarClock}
                      label="Horario combinado"
                      value={assisted.scheduledArrivalAt}
                      onToggle={() =>
                        saveFields(reservation, {
                          scheduledArrivalAt: assisted.scheduledArrivalAt ? null : new Date().toISOString(),
                        })
                      }
                      disabled={saving}
                    />
                    <StepButton
                      icon={MessageSquareText}
                      label="Regras enviadas"
                      value={assisted.rulesMessageSentAt}
                      onToggle={() =>
                        assisted.rulesMessageSentAt
                          ? toggleTimestamp(reservation, "rulesMessageSentAt")
                          : confirmRulesSent(reservation)
                      }
                      disabled={saving}
                    />
                    <StepButton
                      icon={FileCheck2}
                      label="Documentos recebidos"
                      value={assisted.documentsReceivedAt}
                      onToggle={() => toggleTimestamp(reservation, "documentsReceivedAt")}
                      disabled={saving}
                    />
                    <StepButton
                      icon={KeyRound}
                      label="Chaves entregues"
                      value={assisted.keyDeliveryConfirmedAt}
                      onToggle={() => toggleTimestamp(reservation, "keyDeliveryConfirmedAt")}
                      disabled={saving}
                    />
                  </div>
                </div>

                {assisted.complete ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <CheckCircle2 size={16} />
                    Chaves entregues. Check-in presencial realizado.
                  </div>
                ) : assisted.readyForActivation ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-100">
                    <CheckCircle2 size={16} />
                    Horario, regras e documentos confirmados. Reserva ativa.
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
