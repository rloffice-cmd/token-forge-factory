/**
 * AI Job Processor Edge Function
 * מעבד Jobs באמצעות Lovable AI ומחזיר תוצאות אמיתיות
 * Supports multiple AI service types
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lovable AI Gateway endpoint
const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface JobTask {
  id: string;
  name: string;
  policy_json: {
    source?: string;
    input?: string;
    service_type?: string;
    webhook_url?: string;
    [key: string]: unknown;
  };
}

interface AIResult {
  success: boolean;
  output: unknown;
  confidence: number;
  tokens_used: number;
  model: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { job_id } = body;

    console.log(`🤖 AI Job Processor starting for job: ${job_id || 'new'}`);

    // If job_id provided, process that specific job
    // Otherwise, find pending jobs
    let jobsToProcess: Array<{ id: string; task_id: string; customer_id: string | null }> = [];

    if (job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, task_id, customer_id')
        .eq('id', job_id)
        .eq('status', 'CREATED')
        .single();
      
      if (job) jobsToProcess = [job];
    } else {
      // Find all pending jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, task_id, customer_id')
        .eq('status', 'CREATED')
        .order('created_at', { ascending: true })
        .limit(5);
      
      jobsToProcess = jobs || [];
    }

    if (jobsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const job of jobsToProcess) {
      try {
        // Update status to processing
        await supabase
          .from('jobs')
          .update({ status: 'GENERATED', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        // Get task details
        const { data: task } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', job.task_id)
          .single();

        if (!task) {
          throw new Error('Task not found');
        }

        // Process with AI
        const aiResult = await processWithAI(task as JobTask, lovableApiKey);

        if (aiResult.success) {
          // Save artifacts
          await supabase.from('artifacts').insert([
            {
              job_id: job.id,
              type: 'AI_OUTPUT',
              content: JSON.stringify(aiResult.output),
            },
            {
              job_id: job.id,
              type: 'PROOF_PACK',
              content: JSON.stringify({
                result: aiResult.output,
                confidence: aiResult.confidence,
                model: aiResult.model,
                tokens_used: aiResult.tokens_used,
                timestamp: new Date().toISOString(),
                checksum: generateChecksum(JSON.stringify(aiResult.output)),
              }),
            },
          ]);

          // Update job as completed
          await supabase
            .from('jobs')
            .update({
              status: 'SETTLED',
              score: aiResult.confidence,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // Audit log
          await supabase.from('audit_logs').insert({
            job_id: job.id,
            action: 'ai_job_completed',
            metadata: {
              model: aiResult.model,
              tokens_used: aiResult.tokens_used,
              confidence: aiResult.confidence,
            },
          });

          // Send webhook if configured
          const webhookUrl = task.policy_json?.webhook_url;
          if (webhookUrl) {
            fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                job_id: job.id,
                status: 'completed',
                result: aiResult.output,
                confidence: aiResult.confidence,
              }),
            }).catch(err => console.warn('Webhook failed:', err));
          }

          results.push({ job_id: job.id, success: true, confidence: aiResult.confidence });
        } else {
          throw new Error(aiResult.error || 'AI processing failed');
        }

      } catch (err) {
        console.error(`Job ${job.id} failed:`, err);
        
        await supabase
          .from('jobs')
          .update({
            status: 'FAILED',
            score: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        await supabase.from('audit_logs').insert({
          job_id: job.id,
          action: 'ai_job_failed',
          metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
        });

        results.push({ job_id: job.id, success: false, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ Processed ${results.length} jobs, ${successCount} succeeded`);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Job Processor error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Process task with Lovable AI
 */
async function processWithAI(task: JobTask, apiKey: string): Promise<AIResult> {
  const input = task.policy_json?.input || task.name;
  const serviceType = task.policy_json?.service_type || detectServiceType(input);

  // Build prompt based on service type
  const systemPrompt = getSystemPrompt(serviceType);
  const userPrompt = buildUserPrompt(serviceType, input);

  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Token Forge Factory',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    // Parse structured output
    const parsedOutput = parseAIOutput(content, serviceType);

    return {
      success: true,
      output: parsedOutput,
      confidence: calculateConfidence(parsedOutput, serviceType),
      tokens_used: tokensUsed,
      model: 'gemini-2.5-flash',
    };

  } catch (err) {
    return {
      success: false,
      output: null,
      confidence: 0,
      tokens_used: 0,
      model: 'gemini-2.5-flash',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Detect service type from input
 */
function detectServiceType(input: string): string {
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('summarize') || lowerInput.includes('summary') || lowerInput.includes('סכם')) {
    return 'summarization';
  }
  if (lowerInput.includes('translate') || lowerInput.includes('תרגם')) {
    return 'translation';
  }
  if (lowerInput.includes('analyze') || lowerInput.includes('analysis') || lowerInput.includes('נתח')) {
    return 'analysis';
  }
  if (lowerInput.includes('extract') || lowerInput.includes('חלץ')) {
    return 'extraction';
  }
  if (lowerInput.includes('generate') || lowerInput.includes('create') || lowerInput.includes('צור')) {
    return 'generation';
  }
  if (lowerInput.includes('code') || lowerInput.includes('קוד') || lowerInput.includes('function')) {
    return 'coding';
  }
  
  return 'general';
}

/**
 * Get system prompt for service type
 */
function getSystemPrompt(serviceType: string): string {
  const prompts: Record<string, string> = {
    summarization: `You are an expert summarizer. Create concise, accurate summaries that capture the key points.
Output format: JSON with "summary" (string), "key_points" (array), and "word_count" (number).`,
    
    translation: `You are a professional translator. Provide accurate, natural translations.
Output format: JSON with "translation" (string), "source_language" (string), "target_language" (string).`,
    
    analysis: `You are a data analyst. Provide insightful analysis with actionable conclusions.
Output format: JSON with "analysis" (string), "insights" (array), "recommendations" (array).`,
    
    extraction: `You are an information extractor. Extract structured data accurately.
Output format: JSON with "extracted_data" (object), "entities" (array), "confidence" (number 0-1).`,
    
    generation: `You are a creative content generator. Create high-quality, original content.
Output format: JSON with "content" (string), "type" (string), "metadata" (object).`,
    
    coding: `You are an expert programmer. Write clean, efficient, well-documented code.
Output format: JSON with "code" (string), "language" (string), "explanation" (string), "complexity" (string).`,
    
    general: `You are a helpful AI assistant. Provide accurate, well-structured responses.
Output format: JSON with "response" (string), "type" (string), "confidence" (number 0-1).`,
  };

  return prompts[serviceType] + '\n\nAlways respond with valid JSON only, no markdown or explanations outside the JSON.';
}

/**
 * Build user prompt
 */
function buildUserPrompt(serviceType: string, input: string): string {
  const prefixes: Record<string, string> = {
    summarization: 'Please summarize the following:\n\n',
    translation: 'Please translate the following:\n\n',
    analysis: 'Please analyze the following:\n\n',
    extraction: 'Please extract structured data from:\n\n',
    generation: 'Please generate content based on:\n\n',
    coding: 'Please write code for:\n\n',
    general: 'Please process the following request:\n\n',
  };

  return (prefixes[serviceType] || prefixes.general) + input;
}

/**
 * Parse AI output to structured format
 */
function parseAIOutput(content: string, serviceType: string): unknown {
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If no JSON found, wrap the response
    return {
      response: content,
      type: serviceType,
      raw: true,
    };
  } catch {
    return {
      response: content,
      type: serviceType,
      parse_error: true,
    };
  }
}

/**
 * Calculate confidence score
 */
function calculateConfidence(output: unknown, serviceType: string): number {
  if (!output || typeof output !== 'object') return 0.5;
  
  const obj = output as Record<string, unknown>;
  
  // Check if output has expected fields
  const expectedFields: Record<string, string[]> = {
    summarization: ['summary', 'key_points'],
    translation: ['translation', 'source_language'],
    analysis: ['analysis', 'insights'],
    extraction: ['extracted_data', 'entities'],
    generation: ['content', 'type'],
    coding: ['code', 'language'],
    general: ['response'],
  };

  const fields = expectedFields[serviceType] || expectedFields.general;
  const presentFields = fields.filter(f => f in obj);
  
  // Base confidence on field presence
  let confidence = presentFields.length / fields.length;
  
  // Boost if explicit confidence provided
  if ('confidence' in obj && typeof obj.confidence === 'number') {
    confidence = (confidence + obj.confidence) / 2;
  }
  
  // Ensure within bounds
  return Math.max(0.5, Math.min(1, confidence));
}

/**
 * Generate checksum for proof pack
 */
function generateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
