import { useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/api";

function toDateOnly(value) {
  return value ? String(value).split("T")[0] : "";
}

function formatDate(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "__/__/__";
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${String(year).slice(-2)}`;
}

export default function CleaningDateModal({ open, onClose, reservation, onUpdated }) {
  const api = useApi();
  const originalCleaningDate = toDateOnly(reservation?.checkoutDate);
  const currentCleaningDate = toDateOnly(
    reservation?.cleaningDateOverride || reservation?.checkoutDate
  );
  const [cleaningDate, setCleaningDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reservation) return;
    setCleaningDate(currentCleaningDate);
    setReason(reservation.cleaningChangeReason || "");
    setError("");
  }, [currentCleaningDate, reservation]);

  const isOriginalDate = useMemo(
    () => cleaningDate === originalCleaningDate,
    [cleaningDate, originalCleaningDate]
  );
  const isClearingOverride = Boolean(reservation?.cleaningDateOverride && isOriginalDate);

  if (!open || !reservation) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const updated = await api(`/reservations/${reservation.id}/cleaning-date`, {
        method: "PUT",
        body: JSON.stringify({
          cleaningDate: isOriginalDate ? null : cleaningDate,
          reason: isOriginalDate ? "" : reason,
        }),
      });

      onUpdated?.(updated);
      onClose();
    } catch (err) {
      console.error("Erro ao alterar limpeza:", err);
      setError(err?.message || "Erro ao alterar data de limpeza.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="font-semibold">Alterar dia de limpeza</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-50">
              {reservation.guest?.name || "Hospede sem nome"}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {reservation.room?.stay?.name ? `${reservation.room.stay.name} - ` : ""}
              {reservation.room?.title || "Sem acomodacao"}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Check-out original: {formatDate(reservation.checkoutDate)}
            </div>
          </div>

          <div>
            <label className="text-sm">Novo dia da limpeza</label>
            <input
              type="date"
              value={cleaningDate}
              onChange={(event) => setCleaningDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              required
            />
          </div>

          <div>
            <label className="text-sm">Motivo</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              rows={3}
              required={!isOriginalDate}
              disabled={isOriginalDate}
              placeholder={isOriginalDate ? "Usando a data original do check-out." : ""}
            />
          </div>

          {reservation.cleaningDateOverride && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              Limpeza atual: {formatDate(reservation.cleaningDateOverride)}
              {reservation.cleaningChangeReason ? ` - ${reservation.cleaningChangeReason}` : ""}
            </div>
          )}

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Salvando..." : isClearingOverride ? "Voltar ao original" : "Salvar limpeza"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
