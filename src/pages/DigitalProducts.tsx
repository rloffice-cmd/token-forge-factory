/**
 * Digital Products Store
 * Instant delivery of guides, templates, and courses
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  BookOpen, FileText, GraduationCap, Shield, 
  Loader2, CreditCard, Zap, CheckCircle 
} from "lucide-react";

interface DigitalProduct {
  id: string;
  name: string;
  name_he: string;
  description: string;
  description_he: string;
  category: string;
  price_usd: number;
  preview_content: string | null;
  sales_count: number;
}

const categoryIcons: Record<string, any> = {
  guide: BookOpen,
  template: FileText,
  course: GraduationCap,
  security: Shield,
};

export default function DigitalProducts() {
  const [selectedProduct, setSelectedProduct] = useState<DigitalProduct | null>(null);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["digital-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_products")
        .select("*")
        .eq("is_active", true)
        .order("price_usd", { ascending: true });
      if (error) throw error;
      return data as DigitalProduct[];
    },
  });

  const handlePurchase = async (product: DigitalProduct) => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-coinbase-checkout", {
        body: {
          product_type: "digital_product",
          product_id: product.id,
          customer_email: email,
          amount_usd: product.price_usd,
          name: product.name,
          description: product.description,
        },
      });

      if (error) throw error;
      
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkout");
    } finally {
      setIsLoading(false);
    }
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero */}
      <div className="container mx-auto px-4 py-16 text-center">
        <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
          <Zap className="h-3 w-3 mr-1" />
          Instant Delivery
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Digital Products
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Premium guides, templates, and courses for developers and entrepreneurs.
          Pay with crypto, get instant access.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Instant download
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Lifetime access
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Pay with ETH/BTC/USDC
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products?.map((product) => {
            const Icon = categoryIcons[product.category] || FileText;
            
            return (
              <Card 
                key={product.id} 
                className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {product.category}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{product.name}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.preview_content && (
                    <div className="p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                      {product.preview_content}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold">
                      ${product.price_usd}
                    </div>
                    {product.sales_count > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {product.sales_count} sold
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Your email for delivery"
                      value={selectedProduct?.id === product.id ? email : ""}
                      onChange={(e) => {
                        setSelectedProduct(product);
                        setEmail(e.target.value);
                      }}
                      onFocus={() => setSelectedProduct(product)}
                    />
                    <Button 
                      className="w-full gap-2"
                      onClick={() => handlePurchase(product)}
                      disabled={isLoading && selectedProduct?.id === product.id}
                    >
                      {isLoading && selectedProduct?.id === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Buy Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Trust Section */}
      <div className="container mx-auto px-4 py-16 border-t">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Secure & Instant</h2>
          <p className="text-muted-foreground mb-8">
            All payments processed securely through Coinbase Commerce. 
            Your product is delivered instantly to your email after payment confirmation.
          </p>
          <div className="flex justify-center gap-8 text-sm text-muted-foreground">
            <div>
              <div className="text-2xl font-bold text-foreground">24h</div>
              <div>Delivery time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">100%</div>
              <div>Satisfaction</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">∞</div>
              <div>Lifetime access</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
