import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Piston API endpoint (public instance)
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

// Security limits
const MAX_SOLUTION_SIZE = 50 * 1024; // 50KB
const MAX_TESTS = 100;

interface ExecuteRequest {
  solution_code: string;
  skeptic_tests: Array<{
    id: string;
    input: string;
    expected_output: string[];
  }>;
  timeout?: number;
}

interface TestResult {
  test_id: string;
  passed: boolean;
  actual_output: string[];
  runtime_ms: number;
  error?: string;
}

interface PistonResult {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    output: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { solution_code, skeptic_tests, timeout = 5000 }: ExecuteRequest = await req.json();

    // Validation guards
    if (!solution_code || !skeptic_tests) {
      return new Response(
        JSON.stringify({ error: 'Missing solution_code or skeptic_tests' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: size limits
    if (solution_code.length > MAX_SOLUTION_SIZE) {
      return new Response(
        JSON.stringify({ error: `Solution code exceeds ${MAX_SOLUTION_SIZE} bytes limit` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (skeptic_tests.length > MAX_TESTS) {
      return new Response(
        JSON.stringify({ error: `Tests exceed ${MAX_TESTS} limit` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build runner-only script (separate from solution)
    const runnerCode = buildRunnerOnly(skeptic_tests);
    
    // Execute via Piston API with retry logic for unstable public API
    const startTime = Date.now();
    const MAX_RETRIES = 3;
    let pistonResult: PistonResult | null = null;
    let lastError: string | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`Piston attempt ${attempt}/${MAX_RETRIES}`);
      
      try {
        const pistonResponse = await fetch(PISTON_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: 'python',
            version: '3.10.0',
            files: [
              {
                name: 'runner.py',
                content: runnerCode,  // Runner FIRST - this is the entry point!
              },
              {
                name: 'solution.py',
                content: solution_code,  // Solution imported by runner
              }
            ],
            stdin: '',
            args: [],
            compile_timeout: 10000,
            run_timeout: Math.min(timeout, 30000), // Hard cap at 30s
            compile_memory_limit: -1,
            run_memory_limit: -1,
          }),
        });

        if (!pistonResponse.ok) {
          lastError = await pistonResponse.text();
          console.error(`Piston API error (attempt ${attempt}):`, lastError);
          continue; // Retry
        }

        const result = await pistonResponse.json();
        
        // Check if we got killed by SIGKILL (common with public Piston)
        if (result.run?.signal === 'SIGKILL') {
          lastError = 'SIGKILL - Piston API overloaded';
          console.log(`Piston SIGKILL (attempt ${attempt}), retrying...`);
          // Wait longer before retry (exponential backoff)
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        
        // Check if we have stdout
        if (!result.run?.stdout) {
          lastError = 'No stdout from Piston';
          console.log(`No stdout (attempt ${attempt}), retrying...`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        
        // Success!
        pistonResult = result;
        console.log(`Piston success on attempt ${attempt}`);
        break;
        
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown fetch error';
        console.error(`Piston fetch error (attempt ${attempt}):`, lastError);
      }
    }
    
    if (!pistonResult) {
      console.error('All Piston attempts failed:', lastError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Sandbox execution failed after retries',
          details: lastError,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const totalRuntime = Date.now() - startTime;

    // Log full Piston response for debugging
    console.log('Piston result:', JSON.stringify(pistonResult, null, 2));

    // Parse test results from stdout
    let results: TestResult[] = [];
    let parseError: string | undefined;

    if (pistonResult.run?.stdout) {
      try {
        // Find JSON output between markers
        const stdout = pistonResult.run.stdout;
        const jsonMatch = stdout.match(/###RESULTS_START###\n([\s\S]*?)\n###RESULTS_END###/);
        
        if (jsonMatch) {
          results = JSON.parse(jsonMatch[1]);
        } else {
          parseError = 'Could not find results markers in output';
          console.log('No markers found in stdout:', stdout.slice(0, 500));
        }
      } catch (e) {
        parseError = `Failed to parse results: ${e}`;
      }
    } else {
      parseError = 'No stdout from Piston';
    }

    // Check for execution errors
    const hasError = pistonResult.run?.stderr || pistonResult.run?.code !== 0;
    
    return new Response(
      JSON.stringify({
        success: !hasError && !parseError,
        results,
        stdout: pistonResult.run?.stdout || '',
        stderr: pistonResult.run?.stderr || '',
        exit_code: pistonResult.run?.code,
        runtime_ms: totalRuntime,
        parse_error: parseError,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in sandbox-runner:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Build runner-only script that imports from solution.py
 * This completely avoids escaping issues by keeping solution code in separate file
 */
function buildRunnerOnly(
  tests: Array<{ id: string; input: string; expected_output: string[] }>
): string {
  // Safely serialize tests to JSON
  const testsJson = JSON.stringify(tests);
  
  return `
import json
import time
from solution import extract_iso_dates

tests = ${testsJson}

results = []

for test in tests:
    test_id = test['id']
    input_text = test['input']
    expected = test['expected_output']
    
    start = time.time()
    error = None
    actual = []
    passed = False
    
    try:
        actual = extract_iso_dates(input_text)
        passed = actual == expected
    except Exception as e:
        error = str(e)
        passed = False
    
    runtime_ms = (time.time() - start) * 1000
    
    results.append({
        'test_id': test_id,
        'passed': passed,
        'actual_output': actual,
        'runtime_ms': round(runtime_ms, 2),
        'error': error
    })

print("###RESULTS_START###")
print(json.dumps(results))
print("###RESULTS_END###")
`.trim();
}
