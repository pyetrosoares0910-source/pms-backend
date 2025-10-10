import { useState, useEffect } from "react";

const CleaningDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [maids, setMaids] = useState([]);

  // Mock inicial – depois trocar por fetch no backend
  useEffect(() => {
    setMaids([
      { id: 1, name: "Maria", maxPerWeek: 5, used: 3 },
      { id: 2, name: "Joana", maxPerWeek: 4, used: 4 },
      { id: 3, name: "Clara", maxPerWeek: 6, used: 2 },
    ]);

    setTasks([
      { id: 101, stay: "Itaim Stay", room: "Lírio 01", maidId: null },
      { id: 102, stay: "JK Stay", room: "Clodomiro 03", maidId: null },
      { id: 103, stay: "Internacional Stay", room: "Taipei 04", maidId: null },
    ]);
  }, []);

  const handleAssign = (taskId, maidId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, maidId } : t))
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Agenda de Limpeza 🧹</h1>
      <table className="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Local</th>
            <th className="border p-2">Acomodação</th>
            <th className="border p-2">Diarista</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="border p-2">{task.stay}</td>
              <td className="border p-2">{task.room}</td>
              <td className="border p-2">
                <select
                  value={task.maidId || ""}
                  onChange={(e) => handleAssign(task.id, Number(e.target.value))}
                  className="border rounded p-1"
                >
                  <option value="">Selecione</option>
                  {maids.map((maid) => (
                    <option
                      key={maid.id}
                      value={maid.id}
                      style={{
                        color: maid.used >= maid.maxPerWeek ? "red" : "inherit",
                      }}
                    >
                      {maid.name} ({maid.used}/{maid.maxPerWeek})
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CleaningDashboard;
