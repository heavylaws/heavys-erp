import React from "react";
import { Button } from "./ui/button";
import { Download } from "lucide-react";

const ExportData: React.FC = () => {
  const handleExport = (logType: "activity" | "inventory") => {
    // We can use a simple anchor link to trigger the download
    const link = document.createElement("a");
    link.href = `/api/export/${logType}`;
    link.setAttribute("download", ""); // This attribute suggests a download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Export Data</h2>
      <div className="flex gap-4">
        <Button onClick={() => handleExport("activity")}>
          <Download className="mr-2 h-4 w-4" />
          Export Activity Log
        </Button>
        <Button onClick={() => handleExport("inventory")}>
          <Download className="mr-2 h-4 w-4" />
          Export Inventory Log
        </Button>
      </div>
    </div>
  );
};

export default ExportData;
