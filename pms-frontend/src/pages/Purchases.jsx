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

      {/* VISUALIZADOR DE COMPRAS EM FORMATO DE RECIBO */}
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
  {purchases.length === 0 && (
    <div className="text-center col-span-full text-gray-400">
      Nenhuma compra registrada
    </div>
  )}

  {purchases.map((p) => {
    const total = (p.quantity || 0) * (p.unitPrice || 0);
    return (
      <div
        key={p.id}
        className="bg-base-100 border border-gray-300 rounded-xl shadow-sm p-4 space-y-3 relative overflow-hidden hover:shadow-md transition"
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-base text-gray-700">
            {p.stay?.name || "Empreendimento"}
          </h3>
          <span className="text-xs text-gray-500">
            {new Date(p.purchaseDate).toLocaleDateString()}
          </span>
        </div>

        {/* Produto e Quantidade */}
        <div className="border-t border-gray-200 pt-2">
          <p className="text-sm font-medium">
            🧴 {p.product?.name || p.notes?.replace("•", "") || "Produto Avulso"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Quantidade: {p.quantity} {p.product?.unitBase || ""}
          </p>
          <p className="text-xs text-gray-600">
            Valor Unitário: R$ {Number(p.unitPrice || 0).toFixed(2)}
          </p>
          <p className="text-sm font-semibold mt-1">
            💰 Total: R$ {total.toFixed(2)}
          </p>
        </div>

        {/* Notas adicionais */}
        {p.notes && (
          <div className="bg-gray-50 text-xs text-gray-600 p-2 rounded-md mt-2">
            {p.notes}
          </div>
        )}

        {/* Rodapé */}
        <div className="flex justify-between items-center mt-2 text-xs border-t pt-2 text-gray-500">
          <span>
            Status:{" "}
            <span
              className={`font-semibold ${
                p.status === "pago" ? "text-green-600" : "text-yellow-600"
              }`}
            >
              {p.status || "pendente"}
            </span>
          </span>

          <button
            onClick={async () => {
              if (confirm("Deseja realmente excluir esta compra?")) {
                try {
                  await axios.delete(`${API}/purchases/${p.id}`);
                  await load();
                } catch (err) {
                  console.error("Erro ao deletar compra:", err);
                  alert("Falha ao excluir compra.");
                }
              }
            }}
            className="text-red-500 hover:text-red-700 transition flex items-center gap-1"
            title="Excluir compra"
          >
            <Trash2 size={14} />
            <span>Excluir</span>
          </button>
        </div>

        {/* Detalhe visual de recibo */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(45deg,#e5e7eb_0_4px,transparent_4px_8px)] opacity-50 rounded-b-xl"></div>
      </div>
    );
  })}
</div>  
    </div>
  );
}
