import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface OutreachJob {
  id: string;
  source: string;
  intent_topic: string;
  confidence: number;
  status: string;
  draft_text: string | null;
  revised_text: string | null;
  ai_draft: string | null;
  message_draft: string | null;
  lead_payload: Record<string, unknown>;
  created_at: string;
}

export default function ManualOutreach() {
  const [jobs, setJobs] = useState<OutreachJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("outreach_jobs")
      .select("*")
      .in("status", ["queued", "gated", "deferred"])
      .order("confidence", { ascending: false })
      .limit(100);
    setJobs((data as unknown as OutreachJob[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const copyDraft = (job: OutreachJob) => {
    const text = job.revised_text || job.draft_text || job.ai_draft || job.message_draft || "";
    navigator.clipboard.writeText(text);
    setCopiedId(job.id);
    toast.success("Draft copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markSent = async (jobId: string) => {
    await supabase
      .from("outreach_jobs")
      .update({ 
        status: "sent", 
        provider_response: { manual_send: true, sent_at: new Date().toISOString() } as unknown as Record<string, never>
      })
      .eq("id", jobId);
    toast.success("Marked as sent");
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const threadUrl = (job: OutreachJob) => {
    const lp = job.lead_payload || {};
    return (lp.thread_url || lp.url || "") as string;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manual Outreach Queue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {jobs.length} leads ready for manual copy-paste dispatch
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {jobs.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No pending outreach jobs.</CardContent></Card>
        )}

        <div className="space-y-4">
          {jobs.map(job => {
            const draft = job.revised_text || job.draft_text || job.ai_draft || job.message_draft || "No draft available";
            const url = threadUrl(job);
            const lead = job.lead_payload || {};
            
            return (
              <Card key={job.id} className="border-border/50 bg-card/80 backdrop-blur">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-medium">
                        {(lead.thread_title || lead.title || job.intent_topic || "Unknown Lead") as string}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{job.source}</Badge>
                        <Badge variant={job.confidence >= 0.9 ? "default" : "secondary"} className="text-xs">
                          {Math.round(job.confidence * 100)}% confidence
                        </Badge>
                        <Badge variant="outline" className="text-xs">{job.status}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-border/30">
                    {draft}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyDraft(job)} variant="outline">
                      {copiedId === job.id ? <CheckCircle className="h-4 w-4 mr-2 text-primary" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copiedId === job.id ? "Copied!" : "Copy Draft"}
                    </Button>
                    <Button size="sm" onClick={() => markSent(job.id)} variant="default">
                      Mark as Sent
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}