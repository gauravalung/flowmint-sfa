-- Adds the many-to-many relationship a single salesman working across
-- multiple distributors needs. employees.distributor_id (from the initial
-- migration) is left in place rather than dropped — it's harmless, and
-- removing it would touch employeeRepository/createEmployee/authService for
-- no real benefit. Going forward, every distributor-scoped query is driven
-- by this mapping table plus an explicit distributor_id the client sends,
-- not by that fixed column.
-- See claude/DECISIONS.md 2026-09-10 (distributor/beat/retailer hierarchy).

CREATE TABLE employee_distributor_mapping (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES employees(id),
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, distributor_id)
);
CREATE INDEX idx_employee_distributor_mapping_employee ON employee_distributor_mapping (employee_id);

-- Backfill: every existing employee's single distributor_id becomes their
-- first mapping row, so already-provisioned salesmen keep working exactly
-- as before with zero data loss.
INSERT INTO employee_distributor_mapping (employee_id, distributor_id)
SELECT id, distributor_id FROM employees WHERE distributor_id IS NOT NULL;
