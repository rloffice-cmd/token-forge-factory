/**
 * Expansion Engine - Client-side utilities
 * For service discovery and lead scoring
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ==========================================
// TYPES
// ==========================================

export interface ServiceCatalogEntry {
  id: string;
  service_key: string;
  name: string;
  description: string | null;
  category: 'ai' | 'data' | 'integration' | 'analytics';
  status: 'planned' | 'development' | 'active' | 'deprecated';
  config: Record<string, unknown>;
  metrics: Record<string, unknown>;
  discovered_by: string | null;
  launched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScalingRule {
  id: string;
  rule_name: string;
  trigger_condition: string;
  action_type: 'scale_up' | 'scale_down' | 'alert' | 'optimize';
  action_config: Record<string, unknown>;
  cooldown_minutes: number;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
}

export interface ImprovementSuggestion {
  id: string;
  source: string;
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'implemented' | 'rejected';
  confidence: number;
  implemented_at: string | null;
  created_at: string;
}

export interface SystemMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_type: 'gauge' | 'counter' | 'histogram';
  dimensions: Record<string, unknown>;
  recorded_at: string;
  created_at: string;
}

export interface ExpansionEngineResult {
  success: boolean;
  result?: {
    services_discovered: number;
    services_added: unknown[];
    leads_scored: number;
    high_priority_leads: unknown[];
    metrics_recorded: number;
  };
  error?: string;
}

// ==========================================
// SERVICE CATALOG
// ==========================================

export async function fetchServiceCatalog(): Promise<ServiceCatalogEntry[]> {
  const { data, error } = await supabase
    .from('service_catalog')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    service_key: row.service_key,
    name: row.name,
    description: row.description,
    category: row.category as ServiceCatalogEntry['category'],
    status: row.status as ServiceCatalogEntry['status'],
    config: (row.config || {}) as Record<string, unknown>,
    metrics: (row.metrics || {}) as Record<string, unknown>,
    discovered_by: row.discovered_by,
    launched_at: row.launched_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchActiveServices(): Promise<ServiceCatalogEntry[]> {
  const { data, error } = await supabase
    .from('service_catalog')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    service_key: row.service_key,
    name: row.name,
    description: row.description,
    category: row.category as ServiceCatalogEntry['category'],
    status: row.status as ServiceCatalogEntry['status'],
    config: (row.config || {}) as Record<string, unknown>,
    metrics: (row.metrics || {}) as Record<string, unknown>,
    discovered_by: row.discovered_by,
    launched_at: row.launched_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function updateServiceStatus(
  serviceId: string,
  status: ServiceCatalogEntry['status']
): Promise<void> {
  const updateData: { status: string; launched_at?: string } = { status };
  
  if (status === 'active') {
    updateData.launched_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('service_catalog')
    .update(updateData)
    .eq('id', serviceId);

  if (error) throw error;
}

// ==========================================
// SCALING RULES
// ==========================================

export async function fetchScalingRules(): Promise<ScalingRule[]> {
  const { data, error } = await supabase
    .from('scaling_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    rule_name: row.rule_name,
    trigger_condition: row.trigger_condition,
    action_type: row.action_type as ScalingRule['action_type'],
    action_config: (row.action_config || {}) as Record<string, unknown>,
    cooldown_minutes: row.cooldown_minutes,
    is_active: row.is_active,
    last_triggered_at: row.last_triggered_at,
    trigger_count: row.trigger_count,
    created_at: row.created_at,
  }));
}

export async function toggleScalingRule(
  ruleId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('scaling_rules')
    .update({ is_active: isActive })
    .eq('id', ruleId);

  if (error) throw error;
}

export async function createScalingRule(rule: Omit<ScalingRule, 'id' | 'created_at' | 'last_triggered_at' | 'trigger_count'>): Promise<ScalingRule> {
  const insertData = {
    rule_name: rule.rule_name,
    trigger_condition: rule.trigger_condition,
    action_type: rule.action_type,
    action_config: rule.action_config as Json,
    cooldown_minutes: rule.cooldown_minutes,
    is_active: rule.is_active,
  };
  
  const { data, error } = await supabase
    .from('scaling_rules')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    rule_name: data.rule_name,
    trigger_condition: data.trigger_condition,
    action_type: data.action_type as ScalingRule['action_type'],
    action_config: (data.action_config || {}) as Record<string, unknown>,
    cooldown_minutes: data.cooldown_minutes,
    is_active: data.is_active,
    last_triggered_at: data.last_triggered_at,
    trigger_count: data.trigger_count,
    created_at: data.created_at,
  };
}

// ==========================================
// IMPROVEMENT SUGGESTIONS
// ==========================================

export async function fetchImprovementSuggestions(
  status?: ImprovementSuggestion['status']
): Promise<ImprovementSuggestion[]> {
  let query = supabase
    .from('improvement_suggestions')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    source: row.source,
    category: row.category,
    title: row.title,
    description: row.description,
    evidence: (row.evidence || {}) as Record<string, unknown>,
    priority: row.priority as ImprovementSuggestion['priority'],
    status: row.status as ImprovementSuggestion['status'],
    confidence: Number(row.confidence),
    implemented_at: row.implemented_at,
    created_at: row.created_at,
  }));
}

export async function updateSuggestionStatus(
  suggestionId: string,
  status: ImprovementSuggestion['status']
): Promise<void> {
  const updateData: { status: string; implemented_at?: string } = { status };
  
  if (status === 'implemented') {
    updateData.implemented_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('improvement_suggestions')
    .update(updateData)
    .eq('id', suggestionId);

  if (error) throw error;
}

// ==========================================
// SYSTEM METRICS
// ==========================================

export async function fetchRecentMetrics(
  metricName?: string,
  limit: number = 100
): Promise<SystemMetric[]> {
  let query = supabase
    .from('system_metrics')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (metricName) {
    query = query.eq('metric_name', metricName);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    metric_name: row.metric_name,
    metric_value: Number(row.metric_value),
    metric_type: row.metric_type as SystemMetric['metric_type'],
    dimensions: (row.dimensions || {}) as Record<string, unknown>,
    recorded_at: row.recorded_at,
    created_at: row.created_at,
  }));
}

export async function recordMetric(
  metricName: string,
  metricValue: number,
  metricType: SystemMetric['metric_type'] = 'gauge',
  dimensions: Record<string, unknown> = {}
): Promise<void> {
  const insertData = {
    metric_name: metricName,
    metric_value: metricValue,
    metric_type: metricType,
    dimensions: dimensions as Json,
  };
  
  const { error } = await supabase.from('system_metrics').insert([insertData]);

  if (error) throw error;
}

// ==========================================
// EXPANSION ENGINE TRIGGER
// ==========================================

export async function triggerExpansionEngine(
  action: 'full_scan' | 'discover_services' | 'score_leads' | 'analyze_market' = 'full_scan'
): Promise<ExpansionEngineResult> {
  const { data, error } = await supabase.functions.invoke('expansion-engine', {
    body: { action },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as ExpansionEngineResult;
}

// ==========================================
// ANALYTICS HELPERS
// ==========================================

export async function getExpansionStats(): Promise<{
  total_services: number;
  active_services: number;
  planned_services: number;
  pending_suggestions: number;
  implemented_suggestions: number;
  active_rules: number;
}> {
  const [services, suggestions, rules] = await Promise.all([
    supabase.from('service_catalog').select('status'),
    supabase.from('improvement_suggestions').select('status'),
    supabase.from('scaling_rules').select('is_active'),
  ]);

  const serviceData = services.data || [];
  const suggestionData = suggestions.data || [];
  const ruleData = rules.data || [];

  return {
    total_services: serviceData.length,
    active_services: serviceData.filter(s => s.status === 'active').length,
    planned_services: serviceData.filter(s => s.status === 'planned').length,
    pending_suggestions: suggestionData.filter(s => s.status === 'pending').length,
    implemented_suggestions: suggestionData.filter(s => s.status === 'implemented').length,
    active_rules: ruleData.filter(r => r.is_active).length,
  };
}
