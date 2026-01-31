/**
 * Public API Edge Function
 * API endpoint for B2B customers
 * Supports: create_job, get_job, get_balance
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface ApiRequest {
  action: 'create_job' | 'get_job' | 'get_balance';
  task?: {
    name: string;
    input: string;
  };
  job_id?: string;
  webhook_url?: string;
}

interface ApiKey {
  id: string;
  customer_id: string;
  key_hash: string;
  name: string;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Validate API Key
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    
    if (!apiKey) {
      return jsonResponse({ 
        success: false, 
        error: 'Missing API Key',
        code: 'UNAUTHORIZED' 
      }, 401);
    }

    // Find customer by API key (simple hash comparison for MVP)
    // In production, use proper key hashing (bcrypt/argon2)
    const { data: customer } = await supabase
      .from('users_customers')
      .select('id, email')
      .eq('email', apiKey) // MVP: using email as API key
      .single();

    if (!customer) {
      return jsonResponse({ 
        success: false, 
        error: 'Invalid API Key',
        code: 'UNAUTHORIZED' 
      }, 401);
    }

    // Parse request body
    const body: ApiRequest = await req.json();
    const { action } = body;

    console.log(`API Request: ${action} from ${customer.email}`);

    switch (action) {
      case 'create_job':
        return await handleCreateJob(supabase, customer.id, body);
      
      case 'get_job':
        return await handleGetJob(supabase, customer.id, body);
      
      case 'get_balance':
        return await handleGetBalance(supabase, customer.id);
      
      default:
        return jsonResponse({ 
          success: false, 
          error: `Unknown action: ${action}`,
          code: 'BAD_REQUEST' 
        }, 400);
    }

  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal error',
      code: 'INTERNAL_ERROR' 
    }, 500);
  }
});

/**
 * Create a new job
 */
async function handleCreateJob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  customerId: string,
  body: ApiRequest
) {
  const { task, webhook_url } = body;

  if (!task?.name || !task?.input) {
    return jsonResponse({ 
      success: false, 
      error: 'Missing task.name or task.input',
      code: 'BAD_REQUEST' 
    }, 400);
  }

  // Check credit balance
  const { data: wallet } = await supabase
    .from('credit_wallets')
    .select('credits_balance')
    .eq('customer_id', customerId)
    .single();

  if (!wallet || wallet.credits_balance < 1) {
    return jsonResponse({ 
      success: false, 
      error: 'Insufficient credits',
      code: 'PAYMENT_REQUIRED' 
    }, 402);
  }

  // Create task
  const { data: taskRecord, error: taskError } = await supabase
    .from('tasks')
    .insert({
      name: task.name,
      policy_json: {
        source: 'api',
        input: task.input,
        webhook_url,
        date_range: { min: '1900-01-01', max: '2100-12-31' }
      },
    })
    .select()
    .single();

  if (taskError) {
    throw new Error(`Failed to create task: ${taskError.message}`);
  }

  // Create job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      task_id: taskRecord.id,
      customer_id: customerId,
      cost_credits: 1,
      status: 'CREATED',
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to create job: ${jobError.message}`);
  }

  // Deduct credits
  await supabase
    .from('credit_wallets')
    .update({
      credits_balance: wallet.credits_balance - 1,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId);

  // Trigger async processing via auto-pipeline
  // (The cron job will pick it up, or we can invoke directly)
  supabase.functions.invoke('auto-pipeline', {
    body: { job_id: job.id },
  }).catch((err: Error) => console.warn('Pipeline trigger failed:', err));

  // Audit log
  await supabase.from('audit_logs').insert({
    job_id: job.id,
    action: 'api_job_created',
    metadata: { 
      customer_id: customerId, 
      task_name: task.name,
      webhook_url: webhook_url || null,
    },
  });

  return jsonResponse({
    success: true,
    job_id: job.id,
    status: 'processing',
    estimated_time_seconds: 30,
  });
}

/**
 * Get job status and result
 */
async function handleGetJob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  customerId: string,
  body: ApiRequest
) {
  const { job_id } = body;

  if (!job_id) {
    return jsonResponse({ 
      success: false, 
      error: 'Missing job_id',
      code: 'BAD_REQUEST' 
    }, 400);
  }

  // Fetch job (only if belongs to customer)
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, status, score, created_at, updated_at, task_id')
    .eq('id', job_id)
    .eq('customer_id', customerId)
    .single();

  if (error || !job) {
    return jsonResponse({ 
      success: false, 
      error: 'Job not found',
      code: 'NOT_FOUND' 
    }, 404);
  }

  // If completed, fetch result from artifacts
  let result = null;
  if (job.status === 'SETTLED' || job.status === 'COMPLETED') {
    const { data: artifact } = await supabase
      .from('artifacts')
      .select('content')
      .eq('job_id', job_id)
      .eq('type', 'JUDGE_JSON')
      .single();

    if (artifact) {
      try {
        const judgeData = JSON.parse(artifact.content);
        result = judgeData.results || judgeData;
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  return jsonResponse({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      score: job.score,
      result,
      created_at: job.created_at,
      completed_at: job.status === 'SETTLED' ? job.updated_at : null,
    },
  });
}

/**
 * Get credit balance
 */
async function handleGetBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  customerId: string
) {
  // Fetch wallet
  const { data: wallet } = await supabase
    .from('credit_wallets')
    .select('credits_balance')
    .eq('customer_id', customerId)
    .single();

  // Fetch job count
  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  // Calculate used credits (total jobs = used credits in simple model)
  const used = totalJobs || 0;

  return jsonResponse({
    success: true,
    balance: {
      credits: wallet?.credits_balance || 0,
      used,
      total_jobs: totalJobs || 0,
    },
  });
}

/**
 * Helper: Create JSON response
 */
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
