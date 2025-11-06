import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Input, Textarea } from "react-daisyui";

const API = `${import.meta.env.VITE_API_URL}/api`;

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    stayId: "",
    productId: "",
    quantityValue: "",
    quantityUnit: "ml",
    unitPrice: "",
    purchaseDate: "",
    notes: "",
  });

  // =================== CARREGAR DADOS ===================
  async function load() {
    try {
      const [prods, purch, staysRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/purchases`),
        axios.get(`${API.replace("/api", "")}/stays`), // stays vem do módulo principal
      ]);
      setProducts(prods.data);
      setPurchases(purch.data || []);
      setStays(staysRes.data || []);
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    }
  }

  // =================== SUBMIT ===================
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        stayId: form.stayId,
        productId: form.productId,
        quantityValue: form.quantityValue ? parseFloat(form.quantityValue) : null,
        quantityUnit: form.quantityUnit,
        unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : null,
        purchaseDate: form.purchaseDate || new Date().toISOString().split("T")[0],
        notes: form.notes || null,
      };

      await axios.post(`${API}/purchases`, payload);

      setForm({
        stayId: "",
        productId: "",
        quantityValue: "",
        quantityUnit: "ml",
        unitPrice: "",
        purchaseDate: "",
        notes: "",
      });

      await load();
    } catch (error) {
      console.error("❌ Erro ao registrar compra:", error);
      alert("Erro ao registrar compra. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // =================== UI ===================
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">🧾 Compras / Entradas de Estoque</h2>

      {/* FORMULÁRIO */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-6 gap-3 bg-base-200 p-5 rounded-xl shadow-sm"
      >
        {/* EMPREENDIMENTO */}
        <select
          value={form.stayId}
          onChange={(e) => setForm({ ...form, stayId: e.target.value })}
          className="col-span-2 select select-bordered"
          required
        >
          <option value="">Selecione o Empreendimento</option>
          {stays.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* PRODUTO */}
        <select
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="col-span-2 select select-bordered"
          required
        >
          <option value="">Selecione o Produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unitBase})
            </option>
          ))}
        </select>

        {/* QUANTIDADE */}
        <Input
          type="number"
          placeholder="Quantidade"
          value={form.quantityValue}
          onChange={(e) => setForm({ ...form, quantityValue: e.target.value })}
          required
        />

        {/* UNIDADE */}
        <select
          value={form.quantityUnit}
          onChange={(e) => setForm({ ...form, quantityUnit: e.target.value })}
          className="select select-bordered"
          required
        >
          <option value="ml">ml</option>
          <option value="L">L</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="un">un</option>
        </select>

        {/* PREÇO */}
        <Input
          type="number"
          step="0.01"
          placeholder="Preço Unitário (R$)"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          required
        />

        {/* DATA */}
        <Input
          type="date"
          value={form.purchaseDate}
          onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
          className="col-span-2"
        />

        {/* NOTAS */}
        <Textarea
          placeholder="Observações (opcional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="col-span-6 h-20"
        />

        <Button
          color="primary"
          type="submit"
          disabled={loading}
          className="col-span-6"
        >
          {loading ? "Salvando..." : "+ Registrar Compra"}
        </Button>
      </form>

      {/* TABELA */}
      <div className="overflow-x-auto bg-base-200 rounded-xl p-4 shadow">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr>
              <th>Data</th>
              <th>Empreendimento</th>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Preço (R$)</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-gray-400">
                  Nenhuma compra registrada
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td>{p.stay?.name || p.stayId}</td>
                <td>{p.product?.name || p.productId}</td>
                <td>{p.quantity} {p.product?.unitBase || ""}</td>
                <td>{p.unitPrice
    ? Number(p.unitPrice).toFixed(2)
    : "-"}
</td>
                <td>{p.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
