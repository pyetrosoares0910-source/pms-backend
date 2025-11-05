// src/utils/units.js

function toBaseUnit(value, input) {
  switch (input) {
    case "ml":
      return { unitBase: "ML", baseValue: Math.round(value) };
    case "L":
      return { unitBase: "ML", baseValue: Math.round(value * 1000) };
    case "g":
      return { unitBase: "G", baseValue: Math.round(value) };
    case "kg":
      return { unitBase: "G", baseValue: Math.round(value * 1000) };
    case "un":
      return { unitBase: "UNIT", baseValue: Math.round(value) };
    default:
      throw new Error("Unsupported unit");
  }
}

module.exports = { toBaseUnit };
