import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Input } from "react-daisyui";

const API = `${import.meta.env.VITE_API_URL}/api`;


export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    stayId: "",
    productId: "",
    quantityValue: "",
    quantityUnit: "ml",
    unitPrice: "",
    purchaseDate: "",
    notes: "",
  });

  async function load() {
    const [prods, purch] = await Promise.all([
      axios.get(`${API}/products`),
      axios.get(`${API}/purchases`), // se ainda não implementado, pode deixar só products
    ]);
    setProducts(prods.data);
    setPurchases(purch.data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await axios.post(`${API}/purchases`, form);
    setForm({
      stayId: "",
      productId: "",
      quantityValue: "",
      quantityUnit: "ml",
      unitPrice: "",
      purchaseDate: "",
      notes: "",
    });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">🧾 Compras / Entradas</h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-2 bg-base-200 p-4 rounded-xl">
        <select
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="col-span-2 select select-bordered"
          required
        >
          <option value="">Selecione o produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <Input
          type="number"
          placeholder="Quantidade"
          value={form.quantityValue}
          onChange={(e) => setForm({ ...form, quantityValue: e.target.value })}
          required
        />
        <Input
          placeholder="Unidade (ml, L, g, kg, un)"
          value={form.quantityUnit}
          onChange={(e) => setForm({ ...form, quantityUnit: e.target.value })}
          required
        />
        <Input
          type="number"
          placeholder="Preço"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
        />
        <Button color="primary" type="submit" className="col-span-6">
          + Registrar Compra
        </Button>
      </form>

      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Data</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{p.product?.name || p.productId}</td>
              <td>{p.quantity}</td>
              <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
              <td>{p.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
