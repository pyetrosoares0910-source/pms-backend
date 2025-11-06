import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Input, Select, Textarea } from "react-daisyui";
import { PlusCircle, Trash2 } from "lucide-react";

const API = `${import.meta.env.VITE_API_URL}/api`;

export default function Purchases() {
  const [stays, setStays] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  // ======== dados da compra =========
  const [purchaseHeader, setPurchaseHeader] = useState({
    stayId: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    status: "pendente",
    notes: "",
  });

  // ======== itens da compra =========
  const [items, setItems] = useState([
    {
      productId: "",
      customDescription: "",
      quantity: "",
      unit: "un",
      unitPrice: "",
    },
  ]);

  // ========================= LOAD =========================
  async function load() {
    const [staysRes, productsRes, purchasesRes] = await Promise.all([
      axios.get(`${API.replace("/api", "")}/stays`),
      axios.get(`${API}/products`),
      axios.get(`${API}/purchases`),
    ]);
    setStays(staysRes.data);
    setProducts(productsRes.data);
    setPurchases(purchasesRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  // ========================= ITENS =========================
  const addItem = () => {
    setItems([
      ...items,
      { productId: "", customDescription: "", quantity: "", unit: "un", unitPrice: "" },
    ]);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const totalCompra = items.reduce((acc, i) => {
    const subtotal =
      parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0);
    return acc + subtotal;
  }, 0);

  // ========================= SALVAR =========================
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      for (const i of items) {
        // tenta usar produto cadastrado ou descrição rápida
        const productId = i.productId || null;
        const productName =
          products.find((p) => p.id === i.productId)?.name ||
          i.customDescription;

        // envia individualmente para o backend atual
        await axios.post(`${API}/purchases`, {
          stayId: purchaseHeader.stayId,
          productId: productId,
          quantityValue: parseFloat(i.quantity || 0),
          quantityUnit: i.unit,
          unitPrice: parseFloat(i.unitPrice || 0),
          purchaseDate: purchaseHeader.purchaseDate,
          notes: `${purchaseHeader.notes} • ${productName}`,
        });
      }

      setPurchaseHeader({
        stayId: "",
        purchaseDate: new Date().toISOString().split("T")[0],
        status: "pendente",
        notes: "",
      });
      setItems([{ productId: "", customDescription: "", quantity: "", unit: "un", unitPrice: "" }]);
      await load();
    } catch (error) {
      console.error("Erro ao salvar compra:", error);
      alert("Falha ao registrar compra. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  }

  // ========================= UI =========================
  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold">🧾 Compras / Entradas de Estoque</h2>

      {/* CABEÇALHO */}
      <form
        onSubmit={handleSubmit}
        className="bg-base-200 rounded-xl p-5 shadow-sm space-y-5"
      >
        <div className="grid grid-cols-6 gap-3">
          <Select
            value={purchaseHeader.stayId}
            onChange={(e) =>
              setPurchaseHeader({ ...purchaseHeader, stayId: e.target.value })
            }
            className="col-span-2 select select-bordered"
            required
          >
            <option value="">Selecione o Empreendimento</option>
            {stays.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={purchaseHeader.purchaseDate}
            onChange={(e) =>
              setPurchaseHeader({
                ...purchaseHeader,
                purchaseDate: e.target.value,
              })
            }
            className="col-span-2"
            required
          />

          <Select
            value={purchaseHeader.status}
            onChange={(e) =>
              setPurchaseHeader({ ...purchaseHeader, status: e.target.value })
            }
            className="col-span-2 select select-bordered"
          >
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </Select>
        </div>

        {/* ITENS DA COMPRA */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">Itens da Compra</h3>
            <Button
              size="sm"
              color="primary"
              onClick={addItem}
              type="button"
              startIcon={<PlusCircle size={16} />}
            >
              Adicionar Item
            </Button>
          </div>

          {items.map((i, index) => (
            <div
              key={index}
              className="grid grid-cols-9 gap-2 bg-base-100 p-3 rounded-lg items-center"
            >
              {/* produto existente */}
              <Select
                value={i.productId}
                onChange={(e) =>
                  updateItem(index, "productId", e.target.value)
                }
                className="col-span-2 select select-bordered"
              >
                <option value="">Produto cadastrado...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>

              {/* ou descrição rápida */}
              <Input
                placeholder="Produto avulso / descrição rápida"
                value={i.customDescription}
                onChange={(e) =>
                  updateItem(index, "customDescription", e.target.value)
                }
                className="col-span-3"
              />

              <Input
                type="number"
                placeholder="Qtd"
                value={i.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                required
              />
              <Select
                value={i.unit}
                onChange={(e) => updateItem(index, "unit", e.target.value)}
                className="select select-bordered"
              >
                <option>ml</option>
                <option>L</option>
                <option>g</option>
                <option>kg</option>
                <option>un</option>
              </Select>
              <Input
                type="number"
                placeholder="Preço Unitário"
                value={i.unitPrice}
                onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
              />
              <div className="text-right text-sm font-semibold">
                R${" "}
                {(
                  parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0)
                ).toFixed(2)}
              </div>
              <Button
                size="sm"
                color="error"
                type="button"
                onClick={() => removeItem(index)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>

        {/* NOTAS E TOTAL */}
        <div className="grid grid-cols-6 gap-3 mt-4 items-center">
          <Textarea
            placeholder="Observações gerais..."
            value={purchaseHeader.notes}
            onChange={(e) =>
              setPurchaseHeader({ ...purchaseHeader, notes: e.target.value })
            }
            className="col-span-4 h-20"
          />
          <div className="col-span-2 text-right pr-4">
            <p className="text-gray-500 text-sm">Total da compra</p>
            <p className="text-xl font-bold text-primary">
              R$ {totalCompra.toFixed(2)}
            </p>
          </div>
        </div>

        <Button color="primary" type="submit" disabled={loading} className="w-full">
          {loading ? "Salvando..." : "💾 Registrar Compra"}
        </Button>
      </form>

      {/* LISTAGEM DE COMPRAS (básica) */}
      <div className="overflow-x-auto bg-base-200 rounded-xl p-4 shadow">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr>
              <th>Data</th>
              <th>Empreendimento</th>
              <th>Produto</th>
              <th>Qtd</th>
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
                <td>{p.stay?.name || "-"}</td>
                <td>{p.product?.name || "-"}</td>
                <td>
                  {p.quantity} {p.product?.unitBase}
                </td>
                <td>{Number(p.unitPrice || 0).toFixed(2)}</td>
                <td>{p.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
