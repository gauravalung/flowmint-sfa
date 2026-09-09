import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as repo from "./statusLogRepository";
import type { StatusEntityType } from "./statusLogRepository";

function toEntry(row: repo.StatusChangeLogRow) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    changedAt: row.changed_at.toISOString(),
    changedByEmployeeId: row.changed_by_employee_id,
    reason: row.reason,
  };
}

export async function listHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const entityType = req.query.entityType as StatusEntityType | undefined;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const rows = await repo.findRecentChanges(entityType ?? null, limit);
    res.json({ changes: rows.map(toEntry) });
  } catch (err) {
    next(err);
  }
}

export async function historyForEntityHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const entityType = req.params.entityType as StatusEntityType;
    const rows = await repo.findHistoryForEntity(entityType, req.params.entityId);
    res.json({ history: rows.map(toEntry) });
  } catch (err) {
    next(err);
  }
}
