import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  Shirt,
  Sparkles,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApi } from "../lib/api";

const operationTypes = [
  ["CHECKOUT_CLEANING", "Limpeza checkout"],
  ["DAILY_CLEANING", "Limpeza diaria"],
  ["DEEP_CLEANING", "Limpeza pesada"],
  ["COMMON_AREA", "Area comum"],
  ["LAUNDRY", "Lavanderia"],
  ["MAINTENANCE", "Manutencao"],
  ["WASTE", "Perda/desperdicio"],
  ["ADJUSTMENT", "Ajuste"],
  ["OTHER", "Outro"],
];

const laundryItems = [
  ["FITTED_SHEET", "Lencol elastico", 1],
  ["TOP_SHEET", "Lencol de cobrir", 1],
  ["PILLOWCASE", "Fronha", 1],
  ["BLANKET", "Manta", 1],
  ["COMFORTER", "Cobertor", 1],
  ["BEDSPREAD", "Colcha", 1],
  ["FACE_TOWEL", "Toalha rosto", 1],
  ["BATH_TOWEL", "Toalha banho", 1],
  ["RUG", "Tapete", 1],
];

const defaultVisibleLaundryTypes = new Set(["FITTED_SHEET", "TOP_SHEET", "PILLOWCASE", "FACE_TOWEL", "BATH_TOWEL"]);

function getLaundryItemMeta(itemType) {
  const item = laundryItems.find(([value]) => value === itemType);
  return {
    itemType,
    label: item?.[1] || itemType,
    unitPieces: item?.[2] || 1,
  };
}

function normalizeLaundryItems(items = []) {
  const map = new Map(laundryItems.map(([itemType, label, unitPieces]) => [itemType, {
    itemType,
    label,
    unitPieces,
    quantity: 0,
    notes: "",
  }]));

  items.forEach((item) => {
    if (!item?.itemType) return;
    const meta = getLaundryItemMeta(item.itemType);
    map.set(item.itemType, {
      itemType: item.itemType,
      label: item.label || meta.label,
      unitPieces: Number(item.unitPieces || meta.unitPieces || 1),
      quantity: Number(item.quantity || 0),
      notes: item.notes || "",
    });
  });

  return [...map.values()];
}

function buildLaundryDraft(roomSummary) {
  const expectedItems = normalizeLaundryItems(roomSummary.expectedItems || []);
  const savedItems = roomSummary.dispatch?.items?.length ? normalizeLaundryItems(roomSummary.dispatch.items) : null;
  const fittedSheets = expectedItems.find((item) => item.itemType === "FITTED_SHEET")?.quantity || 1;

  return {
    id: roomSummary.dispatch?.id || "",
    stayId: roomSummary.stayId || "",
    roomId: roomSummary.roomId || roomSummary.id || "",
    reservationId: roomSummary.reservationId || "",
    maidId: roomSummary.dispatch?.maidId || "",
    dispatchDate: dayjs(roomSummary.dispatch?.dispatchDate || roomSummary.cleaningDate || new Date()).format("YYYY-MM-DD"),
    expectedSets: roomSummary.dispatch?.expectedSets || fittedSheets,
    notes: roomSummary.dispatch?.notes || "",
    items: savedItems || expectedItems,
  };
}

function getLaundryTotalPieces(items = []) {
  return items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPieces || 1), 0);
}

const emptyEntry = {
  stayId: "",
  productId: "",
  quantity: "",
  unit: "L",
  supplier: "",
  unitsPerPackage: "",
  packageBaseQuantity: "",
  totalCost: "",
  entryDate: dayjs().format("YYYY-MM-DD"),
  expiresAt: "",
  notes: "",
};

const emptyConsumption = {
  stayId: "",
  productId: "",
  quantity: "",
  unit: "ml",
  operationType: "CHECKOUT_CLEANING",
  roomId: "",
  reservationId: "",
  maidId: "",
  staffId: "",
  location: "",
  occurredAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  notes: "",
};

const emptyProduct = {
  name: "",
  category: "Limpeza",
  unitBase: "ML",
  packageSizeValue: "",
  packageSizeUnit: "L",
  defaultPrice: "",
  minimumStock: "",
  targetStock: "",
  supplier: "",
  unitsPerPackage: "",
  packageBaseQuantity: "",
  corridorWeight: "1",
};

const emptyCycle = {
  stayId: "",
  productId: "",
  lotId: "",
  startedAt: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
  endedAt: dayjs().format("YYYY-MM-DD"),
  consumedQuantity: "",
  notes: "",
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? dayjs(value).format("DD/MM/YYYY") : "-";
}

function shortDate(value) {
  return value ? dayjs(value).format("DD/MM") : "";
}

function severityClass(severity) {
  if (severity === "CRITICAL") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-100";
  if (severity === "WARNING") return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100";
  return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-100";
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function inputClass(extra = "") {
  return classNames(
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-cyan-700 dark:focus:ring-cyan-950/50",
    extra,
  );
}

function Kpi({ icon: Icon, label, value, tone = "cyan" }) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/45 dark:text-cyan-200",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-50">{value}</div>
        </div>
        <div className={classNames("grid h-10 w-10 place-items-center rounded-lg", tones[tone])}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function TodaySummaryCard({ summary }) {
  const rooms = summary?.rooms || [];
  const visibleRooms = rooms.slice(0, 8);
  const hiddenRooms = Math.max(0, rooms.length - visibleRooms.length);
  const laundry = summary?.laundry || {};
  const bedItemTypes = new Set(["FITTED_SHEET", "TOP_SHEET", "PILLOWCASE", "SHEET_SET", "PILLOWCASE_SET", "BLANKET", "BEDSPREAD"]);
  const towelItemTypes = new Set(["FACE_TOWEL", "BATH_TOWEL"]);
  const expectedItems = laundry.expected || [];
  const bedPieces = expectedItems
    .filter((item) => bedItemTypes.has(item.itemType))
    .reduce((total, item) => total + Number(item.pieces || 0), 0);
  const towelPieces = expectedItems
    .filter((item) => towelItemTypes.has(item.itemType))
    .reduce((total, item) => total + Number(item.pieces || 0), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">Hoje</div>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-5xl font-black leading-none text-slate-950 dark:text-slate-50">{summary?.accommodationCleanings || 0}</span>
            <span className="pb-1 text-sm font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              acomodacoes a limpar
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-cyan-50 px-3 py-2 text-right dark:bg-cyan-950/35">
          <div className="text-2xl font-black text-cyan-800 dark:text-cyan-100">{summary?.corridorCleanings || 0}</div>
          <div className="text-[11px] font-black uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">corredores</div>
        </div>
      </div>

      <div className="min-h-28 px-4 pb-4">
        {visibleRooms.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleRooms.map((room) => (
              <div
                key={room.reservationId || `${room.id}-${room.cleaningDate}`}
                className="group relative min-h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
                title={[room.title, room.guestName, room.stayName].filter(Boolean).join(" - ")}
              >
                {room.imageUrl ? (
                  <img
                    src={room.imageUrl}
                    alt={room.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-lg font-black text-slate-400 dark:text-slate-600">
                    {String(room.title || "UH").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-2">
                  <div className="truncate text-xs font-black text-white">{room.title}</div>
                  {room.guestName ? <div className="truncate text-[10px] font-semibold text-slate-200">{room.guestName}</div> : null}
                </div>
              </div>
            ))}
            {hiddenRooms ? (
              <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-sm font-black text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                +{hiddenRooms}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-bold text-slate-400 dark:border-slate-800">
            Nenhuma limpeza prevista para hoje.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800 lg:grid-cols-4 lg:divide-y-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <Shirt size={18} className="text-cyan-700 dark:text-cyan-200" />
          <div>
            <div className="text-xl font-black text-slate-950 dark:text-slate-50">{bedPieces}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">pecas de cama</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Shirt size={18} className="text-sky-700 dark:text-sky-200" />
          <div>
            <div className="text-xl font-black text-slate-950 dark:text-slate-50">{towelPieces}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">toalhas</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-200" />
          <div>
            <div className="text-xl font-black text-slate-950 dark:text-slate-50">{summary?.alerts?.length || 0}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">alertas</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Boxes size={18} className="text-emerald-700 dark:text-emerald-200" />
          <div>
            <div className="text-xl font-black text-slate-950 dark:text-slate-50">{summary?.productUsage?.length || 0}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">produtos usados</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MiniTable({ columns, rows, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || index} className="hover:bg-cyan-50/40 dark:hover:bg-slate-900/70">
              {columns.map((column) => (
                <td key={column.key} className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700 dark:border-slate-900 dark:text-slate-200">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm font-semibold text-slate-400">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2">
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-200 dark:hover:bg-rose-950/35"
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

function EditModal({ modal, onClose, onChange, onSubmit, products }) {
  if (!modal) return null;

  const fieldSets = {
    entry: [
      ["quantity", "Quantidade", "number"],
      ["unit", "Unidade", "select-unit"],
      ["totalCost", "Valor total", "number"],
      ["supplier", "Fornecedor", "text"],
      ["entryDate", "Data", "date"],
      ["expiresAt", "Validade", "date"],
      ["notes", "Observacoes", "text"],
    ],
    consumption: [
      ["quantity", "Quantidade", "number"],
      ["unit", "Unidade", "select-unit"],
      ["operationType", "Operacao", "select-operation"],
      ["occurredAt", "Data/hora", "datetime-local"],
      ["location", "Local/setor", "text"],
      ["notes", "Observacoes", "text"],
    ],
    cycle: [
      ["consumedQuantity", "Quantidade consumida", "number"],
      ["startedAt", "Inicio", "date"],
      ["endedAt", "Fim/esgotamento", "date"],
      ["notes", "Observacoes", "text"],
    ],
    laundry: [
      ["dispatchDate", "Data envio", "date"],
      ["expectedSets", "Jogos previstos", "number"],
      ["notes", "Observacoes", "text"],
    ],
    product: [
      ["name", "Nome", "text"],
      ["category", "Categoria", "text"],
      ["unitBase", "Unidade base", "select-base"],
      ["packageSizeValue", "Tamanho embalagem", "number"],
      ["packageSizeUnit", "Unidade embalagem", "text"],
      ["packageBaseQuantity", "Qtd base por embalagem", "number"],
      ["unitsPerPackage", "Unidades por pacote", "number"],
      ["minimumStock", "Estoque minimo", "number"],
      ["targetStock", "Estoque alvo", "number"],
      ["corridorWeight", "Peso corredor", "number"],
      ["active", "Produto ativo", "checkbox"],
    ],
  };

  const fields = fieldSets[modal.type] || [];
  const titleByType = {
    entry: "Editar entrada",
    consumption: "Editar uso",
    cycle: "Editar ciclo",
    laundry: "Editar lavanderia",
    product: "Editar produto",
  };

  const renderField = ([key, label, type]) => {
    const value = modal.values[key] ?? "";
    if (type === "checkbox") {
      return (
        <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(key, event.target.checked)}
          />
          {label}
        </label>
      );
    }

    if (type === "select-unit") {
      return (
        <Field key={key} label={label}>
          <select value={value} onChange={(event) => onChange(key, event.target.value)} className={inputClass()}>
            <option>ml</option><option>L</option><option>g</option><option>kg</option><option>un</option><option>pacote</option><option>galao</option><option>caixa</option>
          </select>
        </Field>
      );
    }

    if (type === "select-operation") {
      return (
        <Field key={key} label={label}>
          <select value={value} onChange={(event) => onChange(key, event.target.value)} className={inputClass()}>
            {operationTypes.map(([operationValue, operationLabel]) => (
              <option key={operationValue} value={operationValue}>{operationLabel}</option>
            ))}
          </select>
        </Field>
      );
    }

    if (type === "select-base") {
      return (
        <Field key={key} label={label}>
          <select value={value} onChange={(event) => onChange(key, event.target.value)} className={inputClass()}>
            <option>ML</option><option>G</option><option>UNIT</option>
          </select>
        </Field>
      );
    }

    return (
      <Field key={key} label={label}>
        <input
          type={type}
          step={type === "number" ? "0.01" : undefined}
          value={value}
          onChange={(event) => onChange(key, event.target.value)}
          className={inputClass()}
        />
      </Field>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">{titleByType[modal.type]}</h2>
            {modal.type === "product" && products?.length ? (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Alteracoes afetam novos calculos do estoque.</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {fields.map(renderField)}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">
            Cancelar
          </button>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-800">
            <Save size={16} />
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function InventoryIntelligence() {
  const api = useApi();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    stayId: "",
    from: dayjs().subtract(29, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
  });
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [stays, setStays] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [maids, setMaids] = useState([]);
  const [staff, setStaff] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [lots, setLots] = useState([]);
  const [cycleForm, setCycleForm] = useState(emptyCycle);
  const [closingLotId, setClosingLotId] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [consumptionForm, setConsumptionForm] = useState(emptyConsumption);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [laundryDrafts, setLaundryDrafts] = useState({});

  const selectedStayRooms = useMemo(
    () => rooms.filter((room) => !filters.stayId || room.stayId === filters.stayId),
    [rooms, filters.stayId],
  );

  const reservationOptions = useMemo(() => {
    const roomIds = new Set(selectedStayRooms.map((room) => room.id));
    return reservations.filter((reservation) => !filters.stayId || roomIds.has(reservation.roomId));
  }, [reservations, selectedStayRooms, filters.stayId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (filters.stayId) qs.set("stayId", filters.stayId);
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);

      const [dash, productRows, stayRows, roomRows, maidRows, staffRows, reservationRows, lotRows] = await Promise.all([
        api(`/api/inventory-intelligence/dashboard?${qs.toString()}`),
        api("/api/products"),
        api("/stays"),
        api("/rooms"),
        api("/maids"),
        api("/staff"),
        api("/reservations"),
        api(`/api/inventory-intelligence/lots?${qs.toString()}`),
      ]);
      setDashboard(dash);
      setProducts(Array.isArray(productRows) ? productRows : []);
      setStays(Array.isArray(stayRows) ? stayRows : []);
      setRooms(Array.isArray(roomRows) ? roomRows : []);
      setMaids(Array.isArray(maidRows) ? maidRows : []);
      setStaff(Array.isArray(staffRows) ? staffRows : []);
      setReservations(Array.isArray(reservationRows) ? reservationRows : []);
      setLots(Array.isArray(lotRows) ? lotRows : []);
    } catch (err) {
      console.error("Erro ao carregar estoque inteligente:", err);
      setError(err.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEntryForm((prev) => ({ ...prev, stayId: filters.stayId || prev.stayId }));
    setConsumptionForm((prev) => ({ ...prev, stayId: filters.stayId || prev.stayId }));
    setCycleForm((prev) => ({ ...prev, stayId: filters.stayId || prev.stayId }));
  }, [filters.stayId]);

  async function submitEntry(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/inventory-intelligence/entries", {
        method: "POST",
        body: JSON.stringify(entryForm),
      });
      setEntryForm({ ...emptyEntry, stayId: entryForm.stayId });
      await load();
      setTab("dashboard");
    } catch (err) {
      alert(err.message || "Falha ao registrar entrada.");
    } finally {
      setSaving(false);
    }
  }

  async function submitConsumption(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/inventory-intelligence/consumptions", {
        method: "POST",
        body: JSON.stringify(consumptionForm),
      });
      setConsumptionForm({ ...emptyConsumption, stayId: consumptionForm.stayId });
      await load();
      setTab("dashboard");
    } catch (err) {
      alert(err.message || "Falha ao registrar consumo.");
    } finally {
      setSaving(false);
    }
  }

  async function submitProduct(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...productForm,
          active: true,
          packageSizeValue: productForm.packageSizeValue ? Number(productForm.packageSizeValue) : null,
          defaultPrice: productForm.defaultPrice ? Number(productForm.defaultPrice) : null,
          minimumStock: productForm.minimumStock ? Number(productForm.minimumStock) : null,
          targetStock: productForm.targetStock ? Number(productForm.targetStock) : null,
          unitsPerPackage: productForm.unitsPerPackage ? Number(productForm.unitsPerPackage) : null,
          packageBaseQuantity: productForm.packageBaseQuantity ? Number(productForm.packageBaseQuantity) : null,
          corridorWeight: productForm.corridorWeight ? Number(productForm.corridorWeight) : 1,
        }),
      });
      setProductForm(emptyProduct);
      await load();
    } catch (err) {
      alert(err.message || "Falha ao cadastrar produto.");
    } finally {
      setSaving(false);
    }
  }

  function updateLaundryDraft(reservationId, updater) {
    setLaundryDrafts((prev) => {
      const current = prev[reservationId];
      if (!current) return prev;
      return {
        ...prev,
        [reservationId]: typeof updater === "function" ? updater(current) : { ...current, ...updater },
      };
    });
  }

  function updateLaundryDraftItem(reservationId, itemType, value) {
    updateLaundryDraft(reservationId, (current) => ({
      ...current,
      items: current.items.map((item) => item.itemType === itemType ? { ...item, quantity: value } : item),
    }));
  }

  function addLaundryDraftItem(reservationId, itemType) {
    if (!itemType) return;
    updateLaundryDraft(reservationId, (current) => ({
      ...current,
      items: current.items.map((item) => item.itemType === itemType ? { ...item, quantity: item.quantity > 0 ? item.quantity : 1 } : item),
    }));
  }

  async function saveLaundryDraft(reservationId) {
    const draft = laundryDrafts[reservationId];
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        ...draft,
        items: draft.items
          .map((item) => ({
            itemType: item.itemType,
            quantity: Number(item.quantity || 0),
            unitPieces: Number(item.unitPieces || 1),
            notes: item.notes || null,
          })),
      };
      await api(draft.id ? `/api/inventory-intelligence/laundry/${draft.id}` : "/api/inventory-intelligence/laundry", {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await load();
    } catch (err) {
      alert(err.message || "Falha ao salvar lavanderia.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCycle(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/inventory-intelligence/cycles", {
        method: "POST",
        body: JSON.stringify(cycleForm),
      });
      setCycleForm({ ...emptyCycle, stayId: cycleForm.stayId });
      await load();
      setTab("dashboard");
    } catch (err) {
      alert(err.message || "Falha ao calcular ciclo de consumo.");
    } finally {
      setSaving(false);
    }
  }

  async function closeLotCycle(progress) {
    const depletedAt = window.prompt("Data de esgotamento/reposicao (YYYY-MM-DD)", dayjs().format("YYYY-MM-DD"));
    if (!depletedAt) return;
    const remainingInput = window.prompt("Quantidade que sobrou no lote (base do produto)", "0");
    if (remainingInput === null) return;
    const remainingQuantity = Number(remainingInput || 0);
    const consumedQuantity = Math.max(0, Number(progress.initialQuantity || 0) - remainingQuantity);

    setClosingLotId(progress.lotId);
    try {
      await api(`/api/inventory-intelligence/lots/${progress.lotId}/deplete-cycle`, {
        method: "POST",
        body: JSON.stringify({
          depletedAt,
          remainingQuantity,
          consumedQuantity,
          notes: `Fechado automaticamente: ${progress.accommodationCleanings} acomodacoes + ${progress.corridorCleanings} corredores.`,
        }),
      });
      await load();
    } catch (err) {
      alert(err.message || "Falha ao fechar ciclo do lote.");
    } finally {
      setClosingLotId("");
    }
  }

  async function updateResource(path, payload, fallback) {
    try {
      await api(path, { method: "PUT", body: JSON.stringify(payload) });
      setEditModal(null);
      await load();
    } catch (err) {
      alert(err.message || fallback || "Falha ao atualizar.");
    }
  }

  async function deleteResource(path, message) {
    if (!window.confirm(message || "Deseja excluir este registro?")) return;
    try {
      await api(path, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err.message || "Falha ao excluir.");
    }
  }

  const openEditModal = (type, row) => {
    const valuesByType = {
      entry: {
        quantity: row.quantity ?? "",
        unit: row.unit || "un",
        totalCost: row.totalCost ?? "",
        supplier: row.supplier || "",
        entryDate: row.entryDate ? dayjs(row.entryDate).format("YYYY-MM-DD") : "",
        expiresAt: row.expiresAt ? dayjs(row.expiresAt).format("YYYY-MM-DD") : "",
        notes: row.notes || "",
      },
      consumption: {
        quantity: row.quantity ?? "",
        unit: row.unit || "un",
        operationType: row.operationType || "OTHER",
        occurredAt: row.occurredAt ? dayjs(row.occurredAt).format("YYYY-MM-DDTHH:mm") : "",
        location: row.location || "",
        notes: row.notes || "",
      },
      cycle: {
        consumedQuantity: row.consumedQuantity ?? "",
        startedAt: row.startedAt ? dayjs(row.startedAt).format("YYYY-MM-DD") : "",
        endedAt: row.endedAt ? dayjs(row.endedAt).format("YYYY-MM-DD") : "",
        notes: row.notes || "",
      },
      laundry: {
        dispatchDate: row.dispatchDate ? dayjs(row.dispatchDate).format("YYYY-MM-DD") : "",
        expectedSets: row.expectedSets ?? 0,
        notes: row.notes || "",
      },
      product: {
        name: row.name || "",
        category: row.category || "",
        unitBase: row.unitBase || "UNIT",
        packageSizeValue: row.packageSizeValue ?? "",
        packageSizeUnit: row.packageSizeUnit || "",
        packageBaseQuantity: row.packageBaseQuantity ?? "",
        unitsPerPackage: row.unitsPerPackage ?? "",
        minimumStock: row.minimumStock ?? "",
        targetStock: row.targetStock ?? "",
        corridorWeight: row.corridorWeight ?? 1,
        active: Boolean(row.active),
      },
    };

    setEditModal({ type, row, values: valuesByType[type] || {} });
  };

  const handleEditModalChange = (key, value) => {
    setEditModal((prev) => prev ? { ...prev, values: { ...prev.values, [key]: value } } : prev);
  };

  const submitEditModal = async (event) => {
    event.preventDefault();
    if (!editModal) return;

    const endpoints = {
      entry: `/api/inventory-intelligence/entries/${editModal.row.id}`,
      consumption: `/api/inventory-intelligence/consumptions/${editModal.row.id}`,
      cycle: `/api/inventory-intelligence/cycles/${editModal.row.id}`,
      laundry: `/api/inventory-intelligence/laundry/${editModal.row.id}`,
      product: `/api/products/${editModal.row.id}`,
    };

    await updateResource(endpoints[editModal.type], editModal.values, "Falha ao salvar edicao.");
  };

  async function toggleProductActive(row) {
    try {
      await api(`/api/products/${row.id}/toggle`, { method: "PATCH" });
      await load();
    } catch (err) {
      alert(err.message || "Falha ao alterar status do produto.");
    }
  }

  const kpis = dashboard?.kpis || {};
  const recent = dashboard?.recent || { entries: [], consumptions: [], laundryDispatches: [], usageCycles: [], activeLotProgress: [] };
  const charts = dashboard?.charts || {};
  const todaySummary = useMemo(() => dashboard?.todaySummary || {
    accommodationCleanings: 0,
    corridorCleanings: 0,
    rooms: [],
    laundry: { expected: [], sent: [], expectedPieces: 0, sentPieces: 0, dispatches: 0 },
    alerts: [],
    productUsage: [],
  }, [dashboard?.todaySummary]);

  useEffect(() => {
    setLaundryDrafts((prev) => {
      const next = {};
      (todaySummary.rooms || []).forEach((room) => {
        next[room.reservationId] = prev[room.reservationId] || buildLaundryDraft(room);
      });
      return next;
    });
  }, [todaySummary.date, todaySummary.rooms]);

  return (
    <div className="min-h-screen space-y-5 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/35 dark:text-cyan-200">
            <Sparkles size={14} />
            inteligencia operacional
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Consumiveis e Estoque
          </h1>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <select
            value={filters.stayId}
            onChange={(event) => setFilters((prev) => ({ ...prev, stayId: event.target.value }))}
            className={inputClass()}
          >
            <option value="">Todos empreendimentos</option>
            {stays.map((stay) => (
              <option key={stay.id} value={stay.id}>{stay.name}</option>
            ))}
          </select>
          <input type="date" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} className={inputClass()} />
          <input type="date" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} className={inputClass()} />
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white shadow-lg shadow-cyan-700/15 transition hover:bg-cyan-800"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["dashboard", BarChart3, "Painel"],
          ["entry", PackagePlus, "Entrada"],
          ["consumption", ClipboardCheck, "Uso"],
          ["cycles", TrendingUp, "Ciclos"],
          ["laundry", Shirt, "Lavanderia"],
          ["products", Boxes, "Produtos"],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={classNames(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition",
              tab === key
                ? "border-cyan-600 bg-cyan-700 text-white shadow-lg shadow-cyan-700/15"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-950">
          Carregando modulo inteligente...
        </div>
      ) : null}

      {!loading && tab === "dashboard" ? (
        <div className="space-y-5">
          <TodaySummaryCard summary={todaySummary} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Kpi icon={Boxes} label="Produtos ativos" value={kpis.activeProducts || 0} />
            <Kpi icon={AlertTriangle} label="Criticos" value={kpis.criticalProducts || 0} tone="rose" />
            <Kpi icon={TrendingUp} label="Custo periodo" value={formatMoney(kpis.totalCost)} tone="emerald" />
            <Kpi icon={ClipboardCheck} label="Custo/reserva" value={formatMoney(kpis.costPerReservation)} tone="amber" />
            <Kpi icon={Shirt} label="Pecas lavanderia" value={kpis.laundryPieces || 0} />
            <Kpi icon={CheckCircle2} label="Acomodacoes limpas" value={kpis.accommodationCleanings || 0} tone="emerald" />
            <Kpi icon={ClipboardCheck} label="Corredores" value={kpis.corridorCleanings || 0} tone="cyan" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <Section title="Curva de consumo">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.dailyConsumption || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => dayjs(value).format("DD/MM/YYYY")} />
                    <Area type="monotone" dataKey="quantity" stroke="#0891b2" fill="#67e8f9" fillOpacity={0.35} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Alertas inteligentes">
              <div className="space-y-2">
                {(dashboard?.alerts || []).length ? dashboard.alerts.map((alert, index) => (
                  <div key={alert.id || `${alert.type}-${index}`} className={classNames("rounded-lg border px-3 py-2", severityClass(alert.severity))}>
                    <div className="text-sm font-black">{alert.title}</div>
                    <div className="mt-1 text-xs font-semibold opacity-85">{alert.message}</div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                    Nenhum alerta no periodo.
                  </div>
                )}
              </div>
            </Section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Ranking por produto">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.byProduct || []} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0f766e" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Previsao de reposicao">
              <MiniTable
                empty="Sem previsoes calculadas."
                columns={[
                  { key: "productName", label: "Produto" },
                  { key: "currentStockLabel", label: "Saldo" },
                  { key: "dailyAverage", label: "Media/dia" },
                  { key: "daysRemaining", label: "Duracao", render: (row) => row.daysRemaining === null ? "Sem historico" : `${row.daysRemaining} dias` },
                  { key: "recommendedQuantity", label: "Comprar", render: (row) => row.recommendedQuantity ? row.recommendedQuantity : "-" },
                ]}
                rows={(dashboard?.predictions || []).slice(0, 8)}
              />
            </Section>
          </div>

          <Section title="Estoque operacional">
            <MiniTable
              empty="Nenhum saldo encontrado."
              columns={[
                { key: "stayName", label: "Empreendimento" },
                { key: "productName", label: "Produto" },
                { key: "category", label: "Categoria" },
                { key: "quantityLabel", label: "Saldo" },
                { key: "availability", label: "Disponivel", render: (row) => row.availability === null ? "-" : `${row.availability}%` },
              ]}
              rows={dashboard?.inventory || []}
            />
          </Section>

          <Section title="Uso automatico por lote">
            <MiniTable
              empty="Nenhum lote ativo com limpeza no periodo."
              columns={[
                { key: "productName", label: "Produto" },
                { key: "stayName", label: "Empreendimento" },
                { key: "startedAt", label: "Desde", render: (row) => formatDate(row.startedAt) },
                { key: "accommodationCleanings", label: "Acomodacoes" },
                { key: "corridorCleanings", label: "Corredores" },
                { key: "weightedOperations", label: "Operacoes" },
                { key: "estimatedConsumed", label: "Estimado", render: (row) => row.estimatedConsumed === null ? "sem historico" : row.estimatedConsumed },
                {
                  key: "action",
                  label: "Fechar",
                  render: (row) => (
                    <button
                      type="button"
                      onClick={() => closeLotCycle(row)}
                      disabled={closingLotId === row.lotId}
                      className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-black text-white transition hover:bg-cyan-800 disabled:opacity-60"
                    >
                      {closingLotId === row.lotId ? "Fechando..." : "Fechar ciclo"}
                    </button>
                  ),
                },
              ]}
              rows={dashboard?.activeLotProgress || []}
            />
          </Section>
        </div>
      ) : null}

      {!loading && tab === "entry" ? (
        <Section title="Entrada de estoque">
          <form onSubmit={submitEntry} className="grid gap-3 lg:grid-cols-6">
            <Field label="Empreendimento">
              <select required value={entryForm.stayId} onChange={(event) => setEntryForm((prev) => ({ ...prev, stayId: event.target.value }))} className={inputClass()}>
                <option value="">Selecione</option>
                {stays.map((stay) => <option key={stay.id} value={stay.id}>{stay.name}</option>)}
              </select>
            </Field>
            <Field label="Produto">
              <select required value={entryForm.productId} onChange={(event) => setEntryForm((prev) => ({ ...prev, productId: event.target.value }))} className={inputClass()}>
                <option value="">Selecione</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Quantidade">
              <input required type="number" step="0.01" value={entryForm.quantity} onChange={(event) => setEntryForm((prev) => ({ ...prev, quantity: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Unidade">
              <select value={entryForm.unit} onChange={(event) => setEntryForm((prev) => ({ ...prev, unit: event.target.value }))} className={inputClass()}>
                <option>ml</option><option>L</option><option>g</option><option>kg</option><option>un</option><option>pacote</option><option>galao</option><option>caixa</option>
              </select>
            </Field>
            <Field label="Fornecedor">
              <input value={entryForm.supplier} onChange={(event) => setEntryForm((prev) => ({ ...prev, supplier: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Valor total">
              <input type="number" step="0.01" value={entryForm.totalCost} onChange={(event) => setEntryForm((prev) => ({ ...prev, totalCost: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Data">
              <input type="date" value={entryForm.entryDate} onChange={(event) => setEntryForm((prev) => ({ ...prev, entryDate: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Validade">
              <input type="date" value={entryForm.expiresAt} onChange={(event) => setEntryForm((prev) => ({ ...prev, expiresAt: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Observacoes">
              <input value={entryForm.notes} onChange={(event) => setEntryForm((prev) => ({ ...prev, notes: event.target.value }))} className={inputClass("lg:col-span-3")} />
            </Field>
            <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60 lg:col-span-6">
              <Save size={16} />
              Registrar entrada
            </button>
          </form>
          <div className="mt-5">
            <MiniTable
              empty="Sem entradas recentes."
              columns={[
                { key: "entryDate", label: "Data", render: (row) => formatDate(row.entryDate) },
                { key: "product", label: "Produto", render: (row) => row.product?.name },
                { key: "stay", label: "Empreendimento", render: (row) => row.stay?.name },
                { key: "baseQuantity", label: "Qtd base" },
                { key: "totalCost", label: "Valor", render: (row) => row.totalCost ? formatMoney(row.totalCost) : "-" },
                {
                  key: "actions",
                  label: "Acoes",
                  render: (row) => (
                    <RowActions
                      onEdit={() => openEditModal("entry", row)}
                      onDelete={() => deleteResource(`/api/inventory-intelligence/entries/${row.id}`, "Excluir esta entrada e reverter o saldo?")}
                    />
                  ),
                },
              ]}
              rows={recent.entries || []}
            />
          </div>
        </Section>
      ) : null}

      {!loading && tab === "consumption" ? (
        <Section title="Uso operacional">
          <form onSubmit={submitConsumption} className="grid gap-3 lg:grid-cols-6">
            <Field label="Empreendimento">
              <select required value={consumptionForm.stayId} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, stayId: event.target.value }))} className={inputClass()}>
                <option value="">Selecione</option>
                {stays.map((stay) => <option key={stay.id} value={stay.id}>{stay.name}</option>)}
              </select>
            </Field>
            <Field label="Produto">
              <select required value={consumptionForm.productId} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, productId: event.target.value }))} className={inputClass()}>
                <option value="">Selecione</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Operacao">
              <select value={consumptionForm.operationType} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, operationType: event.target.value }))} className={inputClass()}>
                {operationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Quantidade">
              <input required type="number" step="0.01" value={consumptionForm.quantity} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, quantity: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Unidade">
              <select value={consumptionForm.unit} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, unit: event.target.value }))} className={inputClass()}>
                <option>ml</option><option>L</option><option>g</option><option>kg</option><option>un</option>
              </select>
            </Field>
            <Field label="Data/hora">
              <input type="datetime-local" value={consumptionForm.occurredAt} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, occurredAt: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Acomodacao">
              <select value={consumptionForm.roomId} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, roomId: event.target.value }))} className={inputClass()}>
                <option value="">Opcional</option>
                {selectedStayRooms.map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}
              </select>
            </Field>
            <Field label="Reserva">
              <select value={consumptionForm.reservationId} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, reservationId: event.target.value }))} className={inputClass()}>
                <option value="">Opcional</option>
                {reservationOptions.slice(0, 120).map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.room?.title || "Quarto"} - {formatDate(reservation.checkoutDate)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Diarista">
              <select value={consumptionForm.maidId} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, maidId: event.target.value }))} className={inputClass()}>
                <option value="">Opcional</option>
                {maids.map((maid) => <option key={maid.id} value={maid.id}>{maid.name}</option>)}
              </select>
            </Field>
            <Field label="Funcionario">
              <select value={consumptionForm.staffId} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, staffId: event.target.value }))} className={inputClass()}>
                <option value="">Opcional</option>
                {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </Field>
            <Field label="Local/setor">
              <input value={consumptionForm.location} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, location: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Observacoes">
              <input value={consumptionForm.notes} onChange={(event) => setConsumptionForm((prev) => ({ ...prev, notes: event.target.value }))} className={inputClass()} />
            </Field>
            <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60 lg:col-span-6">
              <Save size={16} />
              Registrar uso
            </button>
          </form>
          <div className="mt-5">
            <MiniTable
              empty="Sem usos recentes."
              columns={[
                { key: "occurredAt", label: "Data", render: (row) => dayjs(row.occurredAt).format("DD/MM HH:mm") },
                { key: "product", label: "Produto", render: (row) => row.product?.name },
                { key: "operationType", label: "Operacao" },
                { key: "quantity", label: "Qtd", render: (row) => `${row.quantity} ${row.unit}` },
                { key: "responsible", label: "Responsavel", render: (row) => row.staff?.name || row.maid?.name || "-" },
                { key: "anomaly", label: "Analise", render: (row) => row.anomalyReason || "coerente" },
                {
                  key: "actions",
                  label: "Acoes",
                  render: (row) => (
                    <RowActions
                      onEdit={() => openEditModal("consumption", row)}
                      onDelete={() => deleteResource(`/api/inventory-intelligence/consumptions/${row.id}`, "Excluir este uso e devolver ao estoque?")}
                    />
                  ),
                },
              ]}
              rows={recent.consumptions || []}
            />
          </div>
        </Section>
      ) : null}

      {!loading && tab === "cycles" ? (
        <Section title="Ciclos de consumo por reposicao">
          <form onSubmit={submitCycle} className="grid gap-3 lg:grid-cols-6">
            <Field label="Empreendimento">
              <select required value={cycleForm.stayId} onChange={(event) => setCycleForm((prev) => ({ ...prev, stayId: event.target.value }))} className={inputClass()}>
                <option value="">Selecione</option>
                {stays.map((stay) => <option key={stay.id} value={stay.id}>{stay.name}</option>)}
              </select>
            </Field>
            <Field label="Produto">
              <select required value={cycleForm.productId} onChange={(event) => {
                const productId = event.target.value;
                const lot = lots.find((item) => item.productId === productId);
                setCycleForm((prev) => ({
                  ...prev,
                  productId,
                  lotId: lot?.id || "",
                  consumedQuantity: lot?.initialQuantity || prev.consumedQuantity,
                }));
              }} className={inputClass()}>
                <option value="">Selecione</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Lote/sobra">
              <select value={cycleForm.lotId} onChange={(event) => {
                const lot = lots.find((item) => item.id === event.target.value);
                setCycleForm((prev) => ({
                  ...prev,
                  lotId: event.target.value,
                  consumedQuantity: lot?.initialQuantity || prev.consumedQuantity,
                  startedAt: lot?.openedAt ? dayjs(lot.openedAt).format("YYYY-MM-DD") : lot?.createdAt ? dayjs(lot.createdAt).format("YYYY-MM-DD") : prev.startedAt,
                  endedAt: lot?.depletedAt ? dayjs(lot.depletedAt).format("YYYY-MM-DD") : prev.endedAt,
                }));
              }} className={inputClass()}>
                <option value="">Sem lote especifico</option>
                {lots
                  .filter((lot) => !cycleForm.productId || lot.productId === cycleForm.productId)
                  .map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.product?.name || "Produto"} - {formatDate(lot.createdAt)} - {lot.status}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Inicio">
              <input required type="date" value={cycleForm.startedAt} onChange={(event) => setCycleForm((prev) => ({ ...prev, startedAt: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Fim/esgotamento">
              <input required type="date" value={cycleForm.endedAt} onChange={(event) => setCycleForm((prev) => ({ ...prev, endedAt: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Qtd consumida base">
              <input required type="number" step="0.01" value={cycleForm.consumedQuantity} onChange={(event) => setCycleForm((prev) => ({ ...prev, consumedQuantity: event.target.value }))} className={inputClass()} />
            </Field>
            <Field label="Observacoes">
              <input value={cycleForm.notes} onChange={(event) => setCycleForm((prev) => ({ ...prev, notes: event.target.value }))} className={inputClass("lg:col-span-5")} />
            </Field>
            <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60 lg:col-span-6">
              <Save size={16} />
              Calcular ciclo
            </button>
          </form>
          <div className="mt-5">
            <MiniTable
              empty="Sem ciclos calculados."
              columns={[
                { key: "endedAt", label: "Periodo", render: (row) => `${formatDate(row.startedAt)} ate ${formatDate(row.endedAt)}` },
                { key: "product", label: "Produto", render: (row) => row.product?.name },
                { key: "consumedQuantity", label: "Consumido" },
                { key: "checkoutCount", label: "Check-outs" },
                { key: "corridorDays", label: "Dias corredor" },
                { key: "avgPerWeightedOperation", label: "Media operacional", render: (row) => row.avgPerWeightedOperation ? Number(row.avgPerWeightedOperation).toFixed(2) : "-" },
                { key: "costPerCheckout", label: "Custo/check-out", render: (row) => row.costPerCheckout ? formatMoney(row.costPerCheckout) : "-" },
                {
                  key: "actions",
                  label: "Acoes",
                  render: (row) => (
                    <RowActions
                      onEdit={() => openEditModal("cycle", row)}
                      onDelete={() => deleteResource(`/api/inventory-intelligence/cycles/${row.id}`, "Excluir este ciclo de aprendizado?")}
                    />
                  ),
                },
              ]}
              rows={recent.usageCycles || []}
            />
          </div>
        </Section>
      ) : null}

      {!loading && tab === "laundry" ? (
        <Section title="Envios para lavanderia">
          <div className="mb-5 grid gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:grid-cols-[1fr_1fr_0.75fr]">
            <div className="lg:border-r lg:border-slate-200 lg:pr-4 lg:dark:border-slate-800">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">Previsto pelos check-outs de hoje</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {(todaySummary.laundry?.expected || []).length ? todaySummary.laundry.expected.map((item) => (
                  <div key={item.itemType} className="flex items-center justify-between gap-2 border-b border-cyan-200/70 py-1 last:border-b-0 dark:border-cyan-900/60">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                    <span className="font-black text-slate-950 dark:text-slate-50">{item.quantity}</span>
                  </div>
                )) : (
                  <div className="col-span-2 py-4 text-sm font-bold text-cyan-800 dark:text-cyan-100">Sem pecas previstas para hoje.</div>
                )}
              </div>
            </div>

            <div className="lg:border-r lg:border-slate-200 lg:pr-4 lg:dark:border-slate-800">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Registrado como enviado hoje</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {(todaySummary.laundry?.sent || []).length ? todaySummary.laundry.sent.map((item) => (
                  <div key={item.itemType} className="flex items-center justify-between gap-2 border-b border-slate-200 py-1 last:border-b-0 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                    <span className="font-black text-slate-950 dark:text-slate-50">{item.quantity}</span>
                  </div>
                )) : (
                  <div className="col-span-2 py-4 text-sm font-bold text-slate-500 dark:text-slate-300">Nenhum envio registrado hoje.</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Totais do dia</div>
              <div className="mt-4 space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Previstas</span>
                  <span className="text-3xl font-black text-slate-950 dark:text-slate-50">{todaySummary.laundry?.expectedPieces || 0}</span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Enviadas</span>
                  <span className="text-3xl font-black text-slate-950 dark:text-slate-50">{todaySummary.laundry?.sentPieces || 0}</span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Registros</span>
                  <span className="text-3xl font-black text-slate-950 dark:text-slate-50">{todaySummary.laundry?.dispatches || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(todaySummary.rooms || []).length ? todaySummary.rooms.map((room) => {
              const draft = laundryDrafts[room.reservationId] || buildLaundryDraft(room);
              const activeItems = draft.items.filter((item) => Number(item.quantity || 0) > 0 || defaultVisibleLaundryTypes.has(item.itemType));
              const extraItems = draft.items.filter((item) => Number(item.quantity || 0) <= 0 && !defaultVisibleLaundryTypes.has(item.itemType));
              return (
                <div key={room.reservationId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-20 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
                        {room.imageUrl ? (
                          <img src={room.imageUrl} alt={room.title} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-sm font-black text-slate-400">{String(room.title || "UH").slice(0, 2).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950 dark:text-slate-50">{room.title}</div>
                        <div className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{room.guestName || room.stayName || "Check-out do dia"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-950 dark:text-slate-50">{getLaundryTotalPieces(draft.items)}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">pecas</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <Field label="Diarista">
                      <select value={draft.maidId || ""} onChange={(event) => updateLaundryDraft(room.reservationId, { maidId: event.target.value })} className={inputClass()}>
                        <option value="">Opcional</option>
                        {maids.map((maid) => <option key={maid.id} value={maid.id}>{maid.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Data">
                      <input type="date" value={draft.dispatchDate} onChange={(event) => updateLaundryDraft(room.reservationId, { dispatchDate: event.target.value })} className={inputClass()} />
                    </Field>
                    <Field label="Observacoes">
                      <input value={draft.notes || ""} onChange={(event) => updateLaundryDraft(room.reservationId, { notes: event.target.value })} className={inputClass()} />
                    </Field>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveLaundryDraft(room.reservationId)}
                      className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60"
                    >
                      <Save size={16} />
                      {draft.id ? "Atualizar" : "Salvar"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {activeItems.map((item) => (
                      <Field key={item.itemType} label={item.label}>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(event) => updateLaundryDraftItem(room.reservationId, item.itemType, event.target.value)}
                          className={inputClass()}
                        />
                      </Field>
                    ))}
                    {extraItems.length ? (
                      <Field label="Adicionar item">
                        <select value="" onChange={(event) => addLaundryDraftItem(room.reservationId, event.target.value)} className={inputClass()}>
                          <option value="">Selecionar</option>
                          {extraItems.map((item) => <option key={item.itemType} value={item.itemType}>{item.label}</option>)}
                        </select>
                      </Field>
                    ) : null}
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-800">
                Nenhuma acomodacao com check-out para lavanderia hoje.
              </div>
            )}
          </div>
          <div className="mt-5">
            <MiniTable
              empty="Sem envios recentes."
              columns={[
                { key: "dispatchDate", label: "Data", render: (row) => formatDate(row.dispatchDate) },
                { key: "room", label: "Acomodacao", render: (row) => row.room?.title || "-" },
                { key: "maid", label: "Diarista", render: (row) => row.maid?.name || "-" },
                { key: "expectedSets", label: "Previsto" },
                { key: "items", label: "Pecas", render: (row) => row.items?.reduce((total, item) => total + item.quantity * item.unitPieces, 0) || 0 },
                {
                  key: "actions",
                  label: "Acoes",
                  render: (row) => (
                    <RowActions
                      onEdit={() => openEditModal("laundry", row)}
                      onDelete={() => deleteResource(`/api/inventory-intelligence/laundry/${row.id}`, "Excluir este envio para lavanderia?")}
                    />
                  ),
                },
              ]}
              rows={recent.laundryDispatches || []}
            />
          </div>
        </Section>
      ) : null}

      {!loading && tab === "products" ? (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Section title="Novo produto">
            <form onSubmit={submitProduct} className="grid gap-3 md:grid-cols-2">
              <Field label="Nome">
                <input required value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Categoria">
                <input required value={productForm.category} onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Unidade base">
                <select value={productForm.unitBase} onChange={(event) => setProductForm((prev) => ({ ...prev, unitBase: event.target.value }))} className={inputClass()}>
                  <option>ML</option><option>G</option><option>UNIT</option>
                </select>
              </Field>
              <Field label="Tamanho embalagem">
                <input type="number" step="0.01" value={productForm.packageSizeValue} onChange={(event) => setProductForm((prev) => ({ ...prev, packageSizeValue: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Unidade embalagem">
                <input value={productForm.packageSizeUnit} onChange={(event) => setProductForm((prev) => ({ ...prev, packageSizeUnit: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Fornecedor padrao">
                <input value={productForm.supplier} onChange={(event) => setProductForm((prev) => ({ ...prev, supplier: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Unidades por pacote">
                <input type="number" step="0.01" value={productForm.unitsPerPackage} onChange={(event) => setProductForm((prev) => ({ ...prev, unitsPerPackage: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Qtd base por embalagem">
                <input type="number" step="0.01" value={productForm.packageBaseQuantity} onChange={(event) => setProductForm((prev) => ({ ...prev, packageBaseQuantity: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Estoque minimo">
                <input type="number" value={productForm.minimumStock} onChange={(event) => setProductForm((prev) => ({ ...prev, minimumStock: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Estoque alvo">
                <input type="number" value={productForm.targetStock} onChange={(event) => setProductForm((prev) => ({ ...prev, targetStock: event.target.value }))} className={inputClass()} />
              </Field>
              <Field label="Peso corredor">
                <input type="number" step="0.1" value={productForm.corridorWeight} onChange={(event) => setProductForm((prev) => ({ ...prev, corridorWeight: event.target.value }))} className={inputClass()} />
              </Field>
              <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60 md:col-span-2">
                <Save size={16} />
                Salvar produto
              </button>
            </form>
          </Section>

          <Section title="Catalogo">
            <MiniTable
              empty="Nenhum produto cadastrado."
              columns={[
                { key: "name", label: "Produto" },
                { key: "category", label: "Categoria" },
                { key: "unitBase", label: "Base" },
                { key: "packageSizeValue", label: "Embalagem", render: (row) => row.packageSizeValue ? `${row.packageSizeValue} ${row.packageSizeUnit || ""}` : "-" },
                { key: "unitsPerPackage", label: "Un/pct", render: (row) => row.unitsPerPackage || "-" },
                { key: "packageBaseQuantity", label: "Base/emb.", render: (row) => row.packageBaseQuantity || "-" },
                { key: "active", label: "Status", render: (row) => row.active ? "Ativo" : "Inativo" },
                {
                  key: "actions",
                  label: "Acoes",
                  render: (row) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleProductActive(row)}
                        className={classNames(
                          "rounded-lg px-2.5 py-1.5 text-xs font-black transition",
                          row.active
                            ? "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/35 dark:text-amber-200"
                            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200"
                        )}
                      >
                        {row.active ? "Inativar" : "Ativar"}
                      </button>
                      <RowActions
                        onEdit={() => openEditModal("product", row)}
                        onDelete={() => deleteResource(`/api/products/${row.id}`, "Excluir este produto e os vinculos antigos dele?")}
                      />
                    </div>
                  ),
                },
              ]}
              rows={products}
            />
          </Section>
        </div>
      ) : null}
      <EditModal
        modal={editModal}
        products={products}
        onClose={() => setEditModal(null)}
        onChange={handleEditModalChange}
        onSubmit={submitEditModal}
      />
    </div>
  );
}
