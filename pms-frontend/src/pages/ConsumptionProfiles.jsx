import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Input, Checkbox } from "react-daisyui";

const API = `${import.meta.env.VITE_API_URL}/api`;

export default function ConsumptionProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    stayId: "",
    roomId: "",
    productId: "",
    consumptionPerCleaning: "",
    appliesToCommonAreas: false,
  });

  async function load() {
    const [prods, profs] = await Promise.all([
      axios.get(`${API}/products`),
      axios.get(`${API}/consumption-profiles`),
    ]);
    setProducts(prods.data);
    setProfiles(profs.data);
  }

  async function createProfile(e) {
    e.preventDefault();
    await axios.post(`${API}/consumption-profiles`, form);
    setForm({
      stayId: "",
      roomId: "",
      productId: "",
      consumptionPerCleaning: "",
      appliesToCommonAreas: false,
    });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <h2 className="text-2xl font-bold">🧹 Perfis de Consumo</h2>

      {/* FORM */}
      <form
        onSubmit={createProfile}
        className="
          grid grid-cols-6 gap-2 
          bg-base-200 dark:bg-slate-900 
          p-4 rounded-xl shadow 
          dark:border dark:border-slate-800
        "
      >
        <Input
          placeholder="Stay ID"
          value={form.stayId}
          onChange={(e) => setForm({ ...form, stayId: e.target.value })}
          required
          className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
        />

        <Input
          placeholder="Room ID (opcional)"
          value={form.roomId}
          onChange={(e) => setForm({ ...form, roomId: e.target.value })}
          className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
        />

        <select
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="
            col-span-2 select select-bordered 
            dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
          "
          required
        >
          <option value="">Produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <Input
          type="number"
          placeholder="Consumo (ml/un)"
          value={form.consumptionPerCleaning}
          onChange={(e) =>
            setForm({ ...form, consumptionPerCleaning: e.target.value })
          }
          required
          className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
        />

        <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <Checkbox
            checked={form.appliesToCommonAreas}
            onChange={(e) =>
              setForm({ ...form, appliesToCommonAreas: e.target.checked })
            }
            className="checkbox checkbox-primary"
          />
          Áreas Comuns
        </label>

        <Button
          color="primary"
          type="submit"
          className="col-span-6"
        >
          + Adicionar Perfil
        </Button>
      </form>

      {/* TABELA */}
      <table
        className="
          table table-zebra w-full 
          bg-white dark:bg-slate-900 
          rounded-xl overflow-hidden 
          border border-gray-200 dark:border-slate-800
        "
      >
        <thead className="bg-gray-200 dark:bg-slate-800 dark:text-slate-200">
          <tr>
            <th>Stay</th>
            <th>Room</th>
            <th>Produto</th>
            <th>Consumo</th>
            <th>Comum?</th>
          </tr>
        </thead>

        <tbody className="dark:[&>tr:nth-child(even)]:bg-slate-800/40">
          {profiles.map((p) => (
            <tr key={p.id} className="dark:hover:bg-slate-800 transition">
              <td>{p.stayId}</td>
              <td>{p.roomId || "—"}</td>
              <td>{p.product?.name}</td>
              <td>{p.consumptionPerCleaning}</td>
              <td>{p.appliesToCommonAreas ? "✅" : "❌"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
