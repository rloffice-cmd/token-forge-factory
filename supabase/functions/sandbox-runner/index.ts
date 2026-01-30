import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Piston API endpoint (public instance)
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { solution_code, skeptic_tests, timeout = 5000 }: ExecuteRequest = await req.json();

    if (!solution_code || !skeptic_tests) {
      return new Response(
        JSON.stringify({ error: 'Missing solution_code or skeptic_tests' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build test runner script
    const testRunnerCode = buildTestRunner(solution_code, skeptic_tests);
    
    // Execute via Piston API
    const startTime = Date.now();
    
    const pistonResponse = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '3.10.0',
        files: [
          {
            name: 'main.py',
            content: testRunnerCode,
          }
        ],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: timeout,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    if (!pistonResponse.ok) {
      const errorText = await pistonResponse.text();
      console.error('Piston API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Sandbox execution failed',
          details: errorText,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pistonResult = await pistonResponse.json();
    const totalRuntime = Date.now() - startTime;

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
          parseError = 'Could not find results in output';
        }
      } catch (e) {
        parseError = `Failed to parse results: ${e}`;
      }
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
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Build Python test runner script that includes the solution and runs all tests
 */
function buildTestRunner(
  solutionCode: string, 
  tests: Array<{ id: string; input: string; expected_output: string[] }>
): string {
  // Escape the solution code for embedding
  const escapedSolution = solutionCode.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  
  // Build tests JSON
  const testsJson = JSON.stringify(tests);
  
  return `
import json
import time
import sys

# ==== SOLUTION CODE ====
${solutionCode}
# ==== END SOLUTION CODE ====

# Test cases
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

# Output results in parseable format
print("###RESULTS_START###")
print(json.dumps(results))
print("###RESULTS_END###")
`;
}
