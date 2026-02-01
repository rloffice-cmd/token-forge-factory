/**
 * Demand Scanner - סורק מקורות ביקוש
 * 
 * סורק מקורות מוגדרים (GitHub Issues, Reddit, פורומים)
 * ומזהה ביקוש פוטנציאלי לשירותים
 * 
 * Kill Gates:
 * - לא סורק מקורות לא פעילים
 * - מדלג על מקורות שנסרקו לאחרונה
 * - מונע כפילויות לפי external_id
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OfferSource {
  id: string;
  name: string;
  source_type: string;
  url: string;
  scan_config: {
    keywords?: string[];
    max_results?: number;
    min_age_hours?: number;
  };
  scan_interval_minutes: number;
  last_scanned_at: string | null;
}

interface EngineConfig {
  scan_enabled: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Check if scanning is enabled
    const { data: configData } = await supabase
      .from('engine_config')
      .select('config_value')
      .eq('config_key', 'scan_enabled')
      .single();

    if (!configData || configData.config_value !== true && configData.config_value !== 'true') {
      console.log('Scanning is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Scanning disabled', scanned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active sources that are due for scanning
    const { data: sources, error: sourcesError } = await supabase
      .from('offer_sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      console.log('No active sources configured');
      return new Response(
        JSON.stringify({ success: true, message: 'No sources to scan', scanned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    let totalSignals = 0;
    const scanResults: { source: string; signals: number; status: string }[] = [];

    for (const source of sources as OfferSource[]) {
      // Check if source is due for scanning
      if (source.last_scanned_at) {
        const lastScan = new Date(source.last_scanned_at);
        const minutesSinceScan = (now.getTime() - lastScan.getTime()) / (1000 * 60);
        
        if (minutesSinceScan < source.scan_interval_minutes) {
          scanResults.push({ 
            source: source.name, 
            signals: 0, 
            status: `skipped - ${Math.round(source.scan_interval_minutes - minutesSinceScan)}m until next scan` 
          });
          continue;
        }
      }

      try {
        const signals = await scanSource(source, supabase);
        totalSignals += signals;
        scanResults.push({ source: source.name, signals, status: 'success' });

        // Update last_scanned_at
        await supabase
          .from('offer_sources')
          .update({ last_scanned_at: now.toISOString() })
          .eq('id', source.id);

      } catch (sourceError) {
        console.error(`Error scanning ${source.name}:`, sourceError);
        scanResults.push({ 
          source: source.name, 
          signals: 0, 
          status: `error: ${sourceError instanceof Error ? sourceError.message : 'unknown'}` 
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Scan complete: ${totalSignals} signals from ${sources.length} sources in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        scanned: sources.length,
        signals_found: totalSignals,
        duration_ms: duration,
        results: scanResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Demand scanner error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scanSource(source: OfferSource, supabase: any): Promise<number> {
  const keywords = source.scan_config.keywords || [];
  
  switch (source.source_type) {
    case 'github_issues':
      return await scanGitHubIssues(source, supabase, keywords);
    
    case 'github_search':
      return await scanGitHubSearch(source, supabase, keywords);
    
    case 'manual':
      // Manual sources don't auto-scan, signals are added manually
      return 0;
    
    default:
      console.log(`Unknown source type: ${source.source_type}`);
      return 0;
  }
}

async function scanGitHubIssues(
  source: OfferSource, 
  supabase: any, 
  keywords: string[]
): Promise<number> {
  // For GitHub, we'd need the GitHub API
  // For now, this is a placeholder that demonstrates the structure
  // In production, you'd use GITHUB_TOKEN and fetch from the API
  
  const githubToken = Deno.env.get('GITHUB_TOKEN');
  if (!githubToken) {
    console.log('GitHub token not configured, skipping GitHub scan');
    return 0;
  }

  // Parse repo from URL (e.g., https://github.com/owner/repo)
  const urlParts = source.url.replace('https://github.com/', '').split('/');
  if (urlParts.length < 2) {
    console.log(`Invalid GitHub URL: ${source.url}`);
    return 0;
  }

  const [owner, repo] = urlParts;
  const searchQuery = keywords.length > 0 
    ? keywords.map(k => `"${k}"`).join(' OR ')
    : 'api OR webhook OR integration';

  try {
    const response = await fetch(
      `https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:issue+is:open+${encodeURIComponent(searchQuery)}&per_page=${source.scan_config.max_results || 20}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DemandScanner/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    let signalsCreated = 0;

    for (const issue of data.items || []) {
      // Calculate urgency based on reactions and comments
      const urgencyScore = Math.min(1, (
        (issue.reactions?.total_count || 0) * 0.1 +
        (issue.comments || 0) * 0.05
      ));

      // Calculate relevance based on keyword matches
      const text = `${issue.title} ${issue.body || ''}`.toLowerCase();
      const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));
      const relevanceScore = keywords.length > 0 
        ? matchedKeywords.length / keywords.length 
        : 0.5;

      // Determine category
      let category = 'api';
      if (text.includes('webhook')) category = 'webhook';
      else if (text.includes('security') || text.includes('audit')) category = 'security';
      else if (text.includes('data') || text.includes('enrichment')) category = 'data';

      // Try to insert (will fail silently on duplicate due to UNIQUE constraint)
      const { error } = await supabase
        .from('demand_signals')
        .upsert({
          source_id: source.id,
          external_id: `github-${issue.id}`,
          source_url: issue.html_url,
          query_text: issue.title,
          payload_json: {
            body: (issue.body || '').substring(0, 1000),
            user: issue.user?.login,
            labels: issue.labels?.map((l: any) => l.name) || [],
            reactions: issue.reactions?.total_count || 0,
            comments: issue.comments || 0,
            created_at: issue.created_at,
          },
          urgency_score: urgencyScore,
          relevance_score: relevanceScore,
          category,
          status: 'new',
        }, {
          onConflict: 'source_id,external_id',
          ignoreDuplicates: true,
        });

      if (!error) {
        signalsCreated++;
      }
    }

    return signalsCreated;

  } catch (error) {
    console.error('GitHub scan error:', error);
    throw error;
  }
}

// Scan GitHub using code/repo search
async function scanGitHubSearch(
  source: OfferSource, 
  supabase: any, 
  keywords: string[]
): Promise<number> {
  const githubToken = Deno.env.get('GITHUB_TOKEN');
  if (!githubToken) {
    console.log('GitHub token not configured, skipping GitHub search');
    return 0;
  }

  const searchQuery = keywords.length > 0 
    ? keywords.join(' OR ')
    : 'webhook OR api OR integration';

  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=updated&per_page=${source.scan_config.max_results || 10}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DemandScanner/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    let signalsCreated = 0;

    for (const repo of data.items || []) {
      const text = `${repo.name} ${repo.description || ''}`.toLowerCase();
      const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));
      const relevanceScore = keywords.length > 0 
        ? matchedKeywords.length / keywords.length 
        : 0.5;

      // Determine category
      let category = 'api';
      if (text.includes('webhook')) category = 'webhook';
      else if (text.includes('security') || text.includes('audit')) category = 'security';
      else if (text.includes('data') || text.includes('enrichment')) category = 'data';

      const { error } = await supabase
        .from('demand_signals')
        .upsert({
          source_id: source.id,
          external_id: `github-repo-${repo.id}`,
          source_url: repo.html_url,
          query_text: repo.full_name,
          payload_json: {
            description: (repo.description || '').substring(0, 1000),
            owner: repo.owner?.login,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            topics: repo.topics || [],
            updated_at: repo.updated_at,
          },
          urgency_score: Math.min(1, repo.stargazers_count / 1000),
          relevance_score: relevanceScore,
          category,
          status: 'new',
        }, {
          onConflict: 'source_id,external_id',
          ignoreDuplicates: true,
        });

      if (!error) {
        signalsCreated++;
      }
    }

    return signalsCreated;

  } catch (error) {
    console.error('GitHub search error:', error);
    throw error;
  }
}
