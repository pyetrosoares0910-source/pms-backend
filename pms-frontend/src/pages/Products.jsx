import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Input, Select } from "react-daisyui";

const API = `${import.meta.env.VITE_API_URL}/api`;


export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    category: "",
    unitBase: "ML",
    packageSizeValue: "",
    packageSizeUnit: "",
    defaultPrice: "",
  });

  async function loadProducts() {
    const res = await axios.get(`${API}/products`);
    setProducts(res.data);
  }

  async function createProduct(e) {
    e.preventDefault();
    await axios.post(`${API}/products`, {
  ...form,
  active: true,
  packageSizeValue: form.packageSizeValue
    ? parseInt(form.packageSizeValue)
    : null,
  defaultPrice: form.defaultPrice
    ? parseFloat(form.defaultPrice)
    : null,
});

    setForm({
      name: "",
      category: "",
      unitBase: "ML",
      packageSizeValue: "",
      packageSizeUnit: "",
      defaultPrice: "",
    });
    loadProducts();
  }

  async function toggleActive(id) {
    await axios.patch(`${API}/products/${id}/toggle`);
    loadProducts();
  }

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">📦 Produtos</h2>

      <form onSubmit={createProduct} className="grid grid-cols-6 gap-2 bg-base-200 p-4 rounded-xl">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome"
          className="col-span-2"
          required
        />
        <Input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Categoria"
          required
        />
        <Select
          value={form.unitBase}
          onChange={(e) => setForm({ ...form, unitBase: e.target.value })}
          className="col-span-1"
        >
          <option>ML</option>
          <option>G</option>
          <option>UNIT</option>
        </Select>
        <Input
          type="number"
          placeholder="Tamanho"
          value={form.packageSizeValue}
          onChange={(e) => setForm({ ...form, packageSizeValue: e.target.value })}
        />
        <Input
          placeholder="Unidade (ml, g, un)"
          value={form.packageSizeUnit}
          onChange={(e) => setForm({ ...form, packageSizeUnit: e.target.value })}
        />
        <Button color="primary" type="submit" className="col-span-6">
          + Adicionar
        </Button>
      </form>

      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Unidade</th>
            <th>Ativo</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.category}</td>
              <td>{p.unitBase}</td>
              <td>{p.active ? "✅" : "❌"}</td>
              <td>
                <Button size="sm" onClick={() => toggleActive(p.id)}>
                  Alternar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
