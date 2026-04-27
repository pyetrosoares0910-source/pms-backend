export const feriadosSP = [
  "2026-01-01", // Confraternizacao Universal
  "2026-01-25", // Aniversario da Cidade de Sao Paulo (municipal)
  "2026-03-04", // extra cleide
  "2026-03-18", // extra cleide
  "2026-04-03", // Paixao de Cristo (Sexta-feira Santa)
  "2026-04-21", // Tiradentes
  "2026-05-01", // Dia do Trabalho
  "2026-06-04", // Corpus Christi (municipal em SP)
  "2026-07-09", // Data Magna do Estado de Sao Paulo (estadual)
  "2026-09-07", // Independencia do Brasil
  "2026-10-12", // Nossa Senhora Aparecida
  "2026-11-02", // Finados
  "2026-11-15", // Proclamacao da Republica
  "2026-11-20", // Dia Nacional de Zumbi e da Consciencia Negra
  "2026-12-25", // Natal
];

export function isHolidaySP(dateISO) {
  return feriadosSP.includes(String(dateISO).split("T")[0]);
}
