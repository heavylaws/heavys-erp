import express from "express";
import { db } from "./db";
import { activityLog, inventoryLog } from "../shared/schema";
import { isAdmin } from "./auth-middleware";

const router = express.Router();

// A simple utility to convert an array of objects to a CSV string
function toCsv(data: any[]): string {
  if (data.length === 0) {
    return "";
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => JSON.stringify(row[header] ?? "")).join(',')
    )
  ];
  return csvRows.join('\n');
}

router.get(
  "/:logType",
  isAdmin, // Protect the route with admin middleware
  async (req, res) => {
    const { logType } = req.params;

    if (logType !== 'activity' && logType !== 'inventory') {
      return res.status(400).json({ message: "Invalid log type specified. Use 'activity' or 'inventory'." });
    }

    try {
      let data;
      let fileName: string;

      if (logType === 'activity') {
        data = await db.select().from(activityLog).orderBy(activityLog.createdAt);
        fileName = `activity_log_${new Date().toISOString()}.csv`;
      } else { // 'inventory'
        data = await db.select().from(inventoryLog).orderBy(inventoryLog.createdAt);
        fileName = `inventory_log_${new Date().toISOString()}.csv`;
      }

      if (data.length === 0) {
          return res.status(404).json({ message: "No log data found to export." });
      }

      const csvData = toCsv(data);

      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "text/csv");
      res.send(csvData);

    } catch (error) {
      console.error(`Error exporting ${logType} log:`, error);
      res.status(500).json({ message: "Failed to export log data." });
    }
  }
);

export const exportRoutes = router;

