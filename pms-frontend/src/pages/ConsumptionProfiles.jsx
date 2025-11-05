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
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">🧹 Perfis de Consumo</h2>

      <form onSubmit={createProfile} className="grid grid-cols-6 gap-2 bg-base-200 p-4 rounded-xl">
        <Input
          placeholder="Stay ID"
          value={form.stayId}
          onChange={(e) => setForm({ ...form, stayId: e.target.value })}
          required
        />
        <Input
          placeholder="Room ID (opcional)"
          value={form.roomId}
          onChange={(e) => setForm({ ...form, roomId: e.target.value })}
        />
        <select
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="col-span-2 select select-bordered"
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
          onChange={(e) => setForm({ ...form, consumptionPerCleaning: e.target.value })}
          required
        />
        <label className="flex items-center gap-2">
          <Checkbox
            checked={form.appliesToCommonAreas}
            onChange={(e) =>
              setForm({ ...form, appliesToCommonAreas: e.target.checked })
            }
          />
          Áreas Comuns
        </label>
        <Button color="primary" type="submit" className="col-span-6">
          + Adicionar Perfil
        </Button>
      </form>

      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Stay</th>
            <th>Room</th>
            <th>Produto</th>
            <th>Consumo</th>
            <th>Comum?</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
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
