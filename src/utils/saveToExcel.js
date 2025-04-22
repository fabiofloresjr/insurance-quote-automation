import XLSX from "xlsx-js-style";

export function saveToExcel(data, filename) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cotações");

  worksheet["!cols"] = [
    { width: 30 },
    { width: 15 },
    { width: 20 },
    { width: 20 },
    { width: 15 },
  ];

  XLSX.writeFile(workbook, filename);
}
