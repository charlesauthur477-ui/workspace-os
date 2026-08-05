import { Router } from "express";
import si from "systeminformation";
import { requireAuth } from "../../middleware/requireAuth";

export const metricsRouter = Router();
metricsRouter.use(requireAuth);

// Powers the "CPU Usage / RAM Usage" widget on the dashboard header.
metricsRouter.get("/system", async (_req, res) => {
  const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()]);
  res.json({
    cpuPercent: Math.round(cpu.currentLoad * 10) / 10,
    ramUsedPercent: Math.round((mem.active / mem.total) * 1000) / 10,
    ramUsedGb: Math.round((mem.active / 1024 / 1024 / 1024) * 10) / 10,
    ramTotalGb: Math.round((mem.total / 1024 / 1024 / 1024) * 10) / 10,
  });
});
