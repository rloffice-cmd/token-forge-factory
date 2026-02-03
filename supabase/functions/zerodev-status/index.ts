/**
 * ZeroDev Status Check
 * Returns the current ZeroDev configuration status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, verifyCronSecret, unauthorizedResponse } from '../_shared/auth-guards.ts';

interface ZeroDevStatus {
  configured: boolean;
  status: 'not_configured' | 'pending' | 'active' | 'error';
  message: string;
  network: string;
  bundlerRpc: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const projectId = Deno.env.get('ZERODEV_PROJECT_ID');
    
    if (!projectId || projectId.trim() === '') {
      const status: ZeroDevStatus = {
        configured: false,
        status: 'not_configured',
        message: 'ZeroDev לא מוגדר - ממתין ל-PROJECT_ID (מזהה פרויקט)',
        network: 'base',
        bundlerRpc: null,
      };
      
      return new Response(JSON.stringify(status), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Project ID exists - ZeroDev is configured and ready
    const status: ZeroDevStatus = {
      configured: true,
      status: 'active',
      message: 'ZeroDev פעיל ומוכן לביצוע עסקאות',
      network: 'base',
      bundlerRpc: `https://rpc.zerodev.app/api/v2/bundler/${projectId.substring(0, 8)}...`,
    };

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('ZeroDev status check error:', err);
    return new Response(JSON.stringify({
      configured: false,
      status: 'error',
      message: `שגיאה בבדיקת ZeroDev: ${errorMessage}`,
      network: 'base',
      bundlerRpc: null,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
