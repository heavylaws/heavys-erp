/**
 * Health check endpoint for Docker monitoring
 */

import type { Express } from "express";

export function registerHealthCheck(app: Express) {
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'Highway Cafe POS',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      features: {
        dualCurrency: true,
        gamification: true,
        realTimeUpdates: true,
        multiRole: true
      }
    });
  });
}