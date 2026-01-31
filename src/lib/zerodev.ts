/**
 * ZeroDev Configuration Module
 * Account Abstraction (אבסטרקציית חשבון) on Base
 * 
 * STATUS: PENDING - Waiting for ZERODEV_PROJECT_ID
 * No execution until PROJECT_ID is provided
 */

// Configuration status
export type ZeroDevStatus = 'not_configured' | 'pending' | 'active' | 'error';

export interface ZeroDevConfig {
  projectId: string | null;
  bundlerRpc: string | null;
  network: 'base' | 'base-sepolia';
  status: ZeroDevStatus;
  message: string;
}

/**
 * Get current ZeroDev configuration status
 * This checks environment for PROJECT_ID without executing anything
 */
export function getZeroDevConfig(): ZeroDevConfig {
  // Check for project ID in environment
  // Note: In production, this will be a Supabase secret
  const projectId = import.meta.env.VITE_ZERODEV_PROJECT_ID || null;
  
  if (!projectId) {
    return {
      projectId: null,
      bundlerRpc: null,
      network: 'base',
      status: 'not_configured',
      message: 'ZeroDev לא מוגדר - ממתין ל-PROJECT_ID (מזהה פרויקט)',
    };
  }

  // Project ID exists but we don't execute until fully validated
  return {
    projectId,
    bundlerRpc: `https://rpc.zerodev.app/api/v2/bundler/${projectId}`,
    network: 'base',
    status: 'pending',
    message: 'ZeroDev מוכן - ממתין לאקטיבציה',
  };
}

/**
 * Session Key permissions structure
 * Defines what the session can do (very limited)
 */
export interface SessionPermissions {
  // Contract addresses this session can interact with
  allowedContracts: string[];
  // Maximum value per transaction (in wei)
  maxValuePerTx: bigint;
  // Time validity
  validUntil: Date;
  // Specific function selectors allowed
  allowedFunctions: string[];
}

/**
 * Create session configuration (DOES NOT EXECUTE)
 * This just prepares the config, no blockchain interaction
 */
export function prepareSessionConfig(permissions: Partial<SessionPermissions>): SessionPermissions {
  return {
    allowedContracts: permissions.allowedContracts || [],
    maxValuePerTx: permissions.maxValuePerTx || BigInt(0),
    validUntil: permissions.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    allowedFunctions: permissions.allowedFunctions || [],
  };
}

/**
 * Check if ZeroDev is ready for execution
 * Returns false until PROJECT_ID is configured
 */
export function isZeroDevReady(): boolean {
  const config = getZeroDevConfig();
  return config.status === 'active';
}

/**
 * Placeholder for future kernel initialization
 * DOES NOT EXECUTE - just returns the plan
 */
export async function planKernelSetup(): Promise<{
  ready: boolean;
  steps: string[];
  blockers: string[];
}> {
  const config = getZeroDevConfig();
  
  const steps = [
    '1. הגדרת ZERODEV_PROJECT_ID בסודות',
    '2. אתחול Kernel Client ב-Base',
    '3. יצירת Session Key עם הרשאות מוגבלות',
    '4. שמירת Session ב-zerodev_sessions',
    '5. הפעלת Executor לביצוע Quest-ים',
  ];
  
  const blockers: string[] = [];
  
  if (!config.projectId) {
    blockers.push('חסר ZERODEV_PROJECT_ID');
  }
  
  return {
    ready: blockers.length === 0,
    steps,
    blockers,
  };
}
