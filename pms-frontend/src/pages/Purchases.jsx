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

      {/* LISTAGEM AGRUPADA EM ROMANEIOS */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  {(() => {
    // ======== Agrupa compras por stay + data ========
    const groups = {};
    purchases.forEach((p) => {
      const key = `${p.stayId}_${new Date(p.purchaseDate)
        .toISOString()
        .split("T")[0]}`;
      if (!groups[key]) {
        groups[key] = {
          stay: p.stay?.name || "Empreendimento",
          date: new Date(p.purchaseDate),
          items: [],
        };
      }
      groups[key].items.push(p);
    });

    const entries = Object.values(groups);

    if (entries.length === 0) {
      return (
        <div className="text-center col-span-full text-gray-400">
          Nenhuma compra registrada
        </div>
      );
    }

    return entries.map((group, index) => {
      const totalCompra = group.items.reduce(
        (acc, i) => acc + (i.quantity || 0) * (i.unitPrice || 0),
        0
      );

      return (
        <div
          key={index}
          className="bg-base-100 border border-gray-300 rounded-xl shadow-sm p-4 space-y-3 relative overflow-hidden hover:shadow-md transition"
        >
          {/* Cabeçalho */}
          <div className="flex justify-between items-center border-b pb-1">
            <div>
              <h3 className="font-bold text-gray-800">{group.stay}</h3>
              <p className="text-xs text-gray-500">
                {group.date.toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Button
              color="error"
              size="xs"
              onClick={async () => {
                if (
                  confirm(
                    "Deseja excluir todas as compras desta data/empreendimento?"
                  )
                ) {
                  try {
                    const ids = group.items.map((i) => i.id);
                    await Promise.all(
                      ids.map((id) => axios.delete(`${API}/purchases/${id}`))
                    );
                    await load();
                  } catch (err) {
                    console.error("Erro ao deletar grupo:", err);
                    alert("Falha ao excluir grupo de compras.");
                  }
                }
              }}
            >
              <Trash2 size={14} />
              Excluir
            </Button>
          </div>

          {/* Lista de produtos */}
          <div className="divide-y divide-gray-200 text-sm">
            {group.items.map((i) => {
              const subtotal = (i.quantity || 0) * (i.unitPrice || 0);
              return (
                <div
                  key={i.id}
                  className="py-2 flex justify-between items-center"
                >
                  <div>
                    <span className="font-medium text-gray-800">
                      {i.product?.name ||
                        i.notes?.replace("•", "").trim() ||
                        "Produto Avulso"}
                    </span>
                    <span className="text-gray-500 ml-1">
                      – {i.quantity} {i.product?.unitBase || ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      R$ {Number(i.unitPrice || 0).toFixed(2)} un.
                    </p>
                    <p className="font-semibold">
                      R$ {subtotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="pt-2 mt-2 border-t flex justify-between items-center">
            <p className="text-sm text-gray-500">Total da compra:</p>
            <p className="text-lg font-bold text-primary">
              R$ {totalCompra.toFixed(2)}
            </p>
          </div>

          {/* Status (simples, por enquanto default pendente) */}
          <div className="flex justify-end items-center text-xs text-gray-500">
            Status:{" "}
            <span className="font-semibold ml-1 text-yellow-600">
              pendente
            </span>
          </div>

          {/* Detalhe visual de recibo */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(45deg,#e5e7eb_0_4px,transparent_4px_8px)] opacity-50 rounded-b-xl"></div>
        </div>
      );
    });
  })()}
</div>

    </div>
  );
}
