import { useEffect, useState } from "react";
import axios from "axios";
import { Progress } from "react-daisyui";

const API = `${import.meta.env.VITE_API_URL}/api`;


export default function Inventory() {
  const [items, setItems] = useState([]);

  async function loadInventory() {
    const res = await axios.get(`${API}/inventory`);
    setItems(res.data);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">📊 Estoque Geral</h2>

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.inventoryId} className="bg-base-200 rounded-xl p-4 shadow">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{item.productName}</h3>
              <span className={item.critical ? "text-error font-semibold" : "text-success"}>
                {item.availability.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={item.availability}
              className={`${
                item.critical ? "progress-error" : "progress-success"
              } w-full`}
            />
            <div className="text-sm mt-1">
              Quantidade: {item.quantity} / Capacidade: {item.capacity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
