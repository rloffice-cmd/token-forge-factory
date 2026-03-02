/**
 * Agent Marketplace Page
 * Public storefront for AI agents and automation tools
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bot, Zap, Shield, Clock, Star, ShoppingCart, Check, Loader2 } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  name_he: string;
  description: string;
  description_he: string;
  category: string;
  price_usd: number;
  features: string[];
  tech_stack: string[];
  demo_url: string | null;
  preview_image: string | null;
  delivery_time_hours: number;
  is_featured: boolean;
  sales_count: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  telegram_bot: <Bot className="h-5 w-5" />,
  discord_bot: <Bot className="h-5 w-5" />,
  monitor: <Shield className="h-5 w-5" />,
  scraper: <Zap className="h-5 w-5" />,
  automation: <Zap className="h-5 w-5" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  telegram_bot: "בוט טלגרם",
  discord_bot: "בוט דיסקורד",
  monitor: "מוניטור",
  scraper: "סקרייפר",
  automation: "אוטומציה",
};

export default function AgentMarketplace() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [orderForm, setOrderForm] = useState({
    email: "",
    telegram: "",
    notes: "",
  });
  const [isOrdering, setIsOrdering] = useState(false);
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agent-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_catalog")
        .select("*")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("sales_count", { ascending: false });
      
      if (error) throw error;
      return data as Agent[];
    },
  });

  const handleOrder = async () => {
    if (!selectedAgent) return;
    if (!orderForm.email) {
      toast.error("אנא הזן את האימייל שלך");
      return;
    }

    setIsOrdering(true);
    try {
      // Create order
      const { data: order, error } = await supabase
        .from("agent_orders")
        .insert({
          agent_id: selectedAgent.id,
          customer_email: orderForm.email,
          customer_telegram: orderForm.telegram || null,
          customization_notes: orderForm.notes || null,
          price_usd: selectedAgent.price_usd,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Create Coinbase checkout and redirect
      toast.success("ההזמנה נוצרה! מעביר לתשלום...", {
        description: `Order ID: ${order.id.slice(0, 8)}`,
      });

      // Reset form
      setOrderForm({ email: "", telegram: "", notes: "" });
      setSelectedAgent(null);
      queryClient.invalidateQueries({ queryKey: ["agent-catalog"] });
    } catch (error) {
      console.error("Order error:", error);
      toast.error("יצירת ההזמנה נכשלה");
    } finally {
      setIsOrdering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="outline" className="mb-4">
              🤖 AI Agent Marketplace
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              סוכנים אוטונומיים מוכנים לשימוש
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              בוטים, מוניטורים ואוטומציות מותאמות אישית - נבנים ב-AI, מסופקים תוך שעות
            </p>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="container mx-auto px-4 py-12">
        {agents && agents.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">הקטלוג בבנייה</h2>
            <p className="text-muted-foreground">
              סוכנים חדשים יתווספו בקרוב. בינתיים, צור קשר להזמנה מותאמת.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents?.map((agent) => (
              <Card key={agent.id} className={agent.is_featured ? "border-primary" : ""}>
                {agent.is_featured && (
                  <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                    ⭐ מומלץ
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[agent.category] || <Bot className="h-5 w-5" />}
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[agent.category] || agent.category}
                      </Badge>
                    </div>
                    {agent.sales_count > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3" />
                        {agent.sales_count} מכירות
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-3">{agent.name_he || agent.name}</CardTitle>
                  <CardDescription>{agent.description_he || agent.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Features */}
                    <div className="space-y-2">
                      {(agent.features as string[] || []).slice(0, 4).map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Tech Stack */}
                    <div className="flex flex-wrap gap-1">
                      {(agent.tech_stack as string[] || []).map((tech, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>

                    {/* Delivery Time */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>אספקה תוך {agent.delivery_time_hours} שעות</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <div className="text-2xl font-bold">
                    ${agent.price_usd}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button onClick={() => setSelectedAgent(agent)}>
                        <ShoppingCart className="h-4 w-4 ml-2" />
                        הזמן עכשיו
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>הזמנת {agent.name_he || agent.name}</DialogTitle>
                        <DialogDescription>
                          מלא את הפרטים ונתחיל לבנות את הסוכן שלך
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">אימייל *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={orderForm.email}
                            onChange={(e) => setOrderForm(f => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telegram">טלגרם (אופציונלי)</Label>
                          <Input
                            id="telegram"
                            placeholder="@username"
                            value={orderForm.telegram}
                            onChange={(e) => setOrderForm(f => ({ ...f, telegram: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">הערות והתאמות (אופציונלי)</Label>
                          <Textarea
                            id="notes"
                            placeholder="תאר שינויים או התאמות שתרצה..."
                            value={orderForm.notes}
                            onChange={(e) => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                          />
                        </div>

                        <div className="bg-muted p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span>סה"כ לתשלום:</span>
                            <span className="text-2xl font-bold">${agent.price_usd}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            תשלום מאובטח ב-ETH דרך Coinbase
                          </p>
                        </div>

                        <Button 
                          className="w-full" 
                          size="lg"
                          onClick={handleOrder}
                          disabled={isOrdering}
                        >
                          {isOrdering ? (
                            <>
                              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                              מעבד...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="h-4 w-4 ml-2" />
                              המשך לתשלום
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Custom Order CTA */}
        <div className="mt-16 bg-muted rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">צריך משהו מותאם אישית?</h2>
          <p className="text-muted-foreground mb-6">
            נבנה עבורך סוכן AI מותאם לצרכים הספציפיים שלך
          </p>
          <Button size="lg" variant="outline">
            צור קשר להצעת מחיר
          </Button>
        </div>
      </div>
    </div>
  );
}
