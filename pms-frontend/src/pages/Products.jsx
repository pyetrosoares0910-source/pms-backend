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
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <h2 className="text-2xl font-bold">📦 Produtos</h2>

      {/* FORM */}
      <form
        onSubmit={createProduct}
        className="grid grid-cols-6 gap-2 bg-base-200 dark:bg-slate-900 dark:border dark:border-slate-700 p-4 rounded-xl shadow"
      >
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome"
          className="col-span-2 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          required
        />
        <Input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Categoria"
          className="bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          required
        />
        <Select
          value={form.unitBase}
          onChange={(e) => setForm({ ...form, unitBase: e.target.value })}
          className="col-span-1 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
        >
          <option>ML</option>
          <option>G</option>
          <option>UNIT</option>
        </Select>
        <Input
          type="number"
          placeholder="Tamanho"
          value={form.packageSizeValue}
          onChange={(e) =>
            setForm({ ...form, packageSizeValue: e.target.value })
          }
          className="bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
        />
        <Input
          placeholder="Unidade (ml, g, un)"
          value={form.packageSizeUnit}
          onChange={(e) =>
            setForm({ ...form, packageSizeUnit: e.target.value })
          }
          className="bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
        />
        <Button
          color="primary"
          type="submit"
          className="col-span-6 mt-1"
        >
          + Adicionar
        </Button>
      </form>

      {/* TABELA */}
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow overflow-hidden">
        <table className="table table-zebra w-full bg-white dark:bg-slate-900 dark:text-slate-100">
          <thead className="bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-slate-100">
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
              <tr
                key={p.id}
                className="hover:bg-gray-50 dark:hover:bg-slate-800 transition"
              >
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{p.unitBase}</td>
                <td>{p.active ? "✅" : "❌"}</td>
                <td>
                  <Button
                    size="sm"
                    onClick={() => toggleActive(p.id)}
                    className="min-h-0 h-8 px-3"
                  >
                    Alternar
                  </Button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-4 text-gray-500 dark:text-slate-500"
                >
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
