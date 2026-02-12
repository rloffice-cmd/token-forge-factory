import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ShieldCheck, Zap, TrendingUp, Search, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ACCESS_CODE = "BROKER2026";

interface Listing {
  id: string;
  niche: string;
  teaser: string;
  tech_stack: string[];
  smart_score: number;
  price_usd: number;
  tier: string;
  created_at: string;
}

export default function LeadMarketplace() {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const handleAuth = () => {
    if (code === ACCESS_CODE) {
      setAuthenticated(true);
      localStorage.setItem("broker_access", "true");
    } else {
      toast({ title: "Invalid Code", description: "Access denied.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (localStorage.getItem("broker_access") === "true") {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchListings();
  }, [authenticated]);

  const fetchListings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_marketplace")
      .select("id, niche, teaser, tech_stack, smart_score, price_usd, tier, created_at")
      .eq("status", "available")
      .order("smart_score", { ascending: false });
    setListings((data as Listing[]) || []);
    setLoading(false);
  };

  const handleBuy = async (listing: Listing) => {
    const email = prompt("Enter your email to receive lead data:");
    if (!email) return;
    const webhook = prompt("Webhook URL for delivery (optional):");

    try {
      const res = await supabase.functions.invoke("unlock-lead", {
        body: {
          listing_id: listing.id,
          buyer_email: email,
          webhook_url: webhook || undefined,
        },
      });

      if (res.error) throw res.error;

      toast({ title: "🎉 Lead Purchased!", description: `$${listing.price_usd} — Full data delivered.` });
      fetchListings();
    } catch {
      toast({ title: "Purchase Failed", description: "Try again or contact support.", variant: "destructive" });
    }
  };

  const filtered = listings.filter(l => {
    const matchesTier = filter === "all" || l.tier === filter;
    const matchesSearch = !search || l.teaser.toLowerCase().includes(search.toLowerCase()) || l.niche.toLowerCase().includes(search.toLowerCase());
    return matchesTier && matchesSearch;
  });

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl">Lead Marketplace</CardTitle>
            <CardDescription>Enter your broker access code to view available leads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Access Code"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAuth()}
            />
            <Button className="w-full" onClick={handleAuth}>Unlock Marketplace</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold">Lead Marketplace</h1>
            <Badge variant="secondary">{filtered.length} Available</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("broker_access"); setAuthenticated(false); }}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              <Filter className="w-4 h-4 mr-1" /> All
            </Button>
            <Button variant={filter === "gold" ? "default" : "outline"} size="sm" onClick={() => setFilter("gold")}>
              <Zap className="w-4 h-4 mr-1" /> Gold ($60)
            </Button>
            <Button variant={filter === "silver" ? "default" : "outline"} size="sm" onClick={() => setFilter("silver")}>
              <TrendingUp className="w-4 h-4 mr-1" /> Silver ($25)
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No leads available. Check back soon.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(listing => (
              <Card key={listing.id} className={`border transition-all hover:shadow-lg ${listing.tier === "gold" ? "border-yellow-500/40 bg-yellow-500/5" : "border-border"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={listing.tier === "gold" ? "default" : "secondary"} className={listing.tier === "gold" ? "bg-yellow-500 text-yellow-950" : ""}>
                      {listing.tier === "gold" ? "⚡ Gold" : "Silver"} — ${listing.price_usd}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">Score: {listing.smart_score}</span>
                  </div>
                  <CardTitle className="text-base leading-snug">{listing.niche}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{listing.teaser}</p>
                  {listing.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {listing.tech_stack.slice(0, 5).map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                  <Button className="w-full" onClick={() => handleBuy(listing)}>
                    Buy Lead — ${listing.price_usd}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
