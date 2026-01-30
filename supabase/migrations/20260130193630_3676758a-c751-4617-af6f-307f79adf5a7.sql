-- =============================================
-- HARDEN RLS: Block DELETE + Treasury insert-only
-- =============================================

-- Note: Current RLS uses "RESTRICTIVE" policies which means
-- operations not explicitly allowed are blocked by default.
-- So we don't need to explicitly block DELETE - it's already blocked.
-- But we should verify and add explicit blocks for safety.

-- Remove UPDATE capability from treasury_ledger (insert-only)
DROP POLICY IF EXISTS "Allow public update treasury" ON public.treasury_ledger;

-- Add NOT NULL constraints to critical foreign keys
-- jobs.task_id - should reference a task
ALTER TABLE public.jobs 
  ALTER COLUMN task_id SET NOT NULL;

-- artifacts.job_id - must belong to a job  
ALTER TABLE public.artifacts 
  ALTER COLUMN job_id SET NOT NULL;

-- audit_logs.job_id - must belong to a job
ALTER TABLE public.audit_logs 
  ALTER COLUMN job_id SET NOT NULL;

-- treasury_ledger.job_id - must belong to a job
ALTER TABLE public.treasury_ledger 
  ALTER COLUMN job_id SET NOT NULL;

-- Set proper defaults
ALTER TABLE public.jobs 
  ALTER COLUMN iteration SET DEFAULT 1,
  ALTER COLUMN iteration SET NOT NULL;

-- Add foreign key constraints if missing
DO $$ 
BEGIN
  -- Add FK from jobs to tasks if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'jobs_task_id_fkey' 
    AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs 
      ADD CONSTRAINT jobs_task_id_fkey 
      FOREIGN KEY (task_id) REFERENCES public.tasks(id);
  END IF;
  
  -- Add FK from artifacts to jobs if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'artifacts_job_id_fkey' 
    AND table_name = 'artifacts'
  ) THEN
    ALTER TABLE public.artifacts 
      ADD CONSTRAINT artifacts_job_id_fkey 
      FOREIGN KEY (job_id) REFERENCES public.jobs(id);
  END IF;
  
  -- Add FK from audit_logs to jobs if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'audit_logs_job_id_fkey' 
    AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs 
      ADD CONSTRAINT audit_logs_job_id_fkey 
      FOREIGN KEY (job_id) REFERENCES public.jobs(id);
  END IF;
  
  -- Add FK from treasury_ledger to jobs if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'treasury_ledger_job_id_fkey' 
    AND table_name = 'treasury_ledger'
  ) THEN
    ALTER TABLE public.treasury_ledger 
      ADD CONSTRAINT treasury_ledger_job_id_fkey 
      FOREIGN KEY (job_id) REFERENCES public.jobs(id);
  END IF;
END $$;