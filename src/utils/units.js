// src/utils/units.js

function toBaseUnit(value, input) {
  const normalized = String(input || "").trim().toLowerCase();
  switch (normalized) {
    case "ml":
      return { unitBase: "ML", baseValue: Math.round(value) };
    case "l":
    case "lt":
    case "litro":
    case "litros":
      return { unitBase: "ML", baseValue: Math.round(value * 1000) };
    case "g":
      return { unitBase: "G", baseValue: Math.round(value) };
    case "kg":
    case "quilo":
    case "quilos":
      return { unitBase: "G", baseValue: Math.round(value * 1000) };
    case "un":
    case "und":
    case "unidade":
    case "unidades":
    case "pct":
    case "pacote":
    case "pacotes":
    case "galao":
    case "galão":
    case "galoes":
    case "galões":
    case "cx":
    case "caixa":
    case "caixas":
      return { unitBase: "UNIT", baseValue: Math.round(value) };
    default:
      throw new Error("Unsupported unit");
  }
}

module.exports = { toBaseUnit };
