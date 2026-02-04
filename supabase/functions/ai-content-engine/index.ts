/**
 * AI Content Engine - Autonomous Content Generation & Distribution
 * מייצר תוכן מקורי, מותאם לפלטפורמות שונות, ומפרסם אוטומטית
 * 
 * Capabilities:
 * 1. Generate educational content about our products
 * 2. Create answers to relevant questions on forums
 * 3. Produce SEO-optimized blog posts
 * 4. Design social media content
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content types and their characteristics
const CONTENT_TYPES = {
  educational_post: {
    description: 'Educational content about crypto/blockchain payment security',
    platforms: ['reddit', 'twitter', 'linkedin'],
    tone: 'expert, helpful, not promotional',
    length: 'medium',
  },
  problem_solution: {
    description: 'Content that identifies a pain point and hints at a solution',
    platforms: ['reddit', 'twitter', 'hackernews'],
    tone: 'empathetic, solution-focused',
    length: 'short',
  },
  case_study: {
    description: 'Real examples of problems our products solve',
    platforms: ['linkedin', 'twitter', 'blog'],
    tone: 'professional, data-driven',
    length: 'long',
  },
  quick_tip: {
    description: 'Short, actionable tips related to our domain',
    platforms: ['twitter', 'reddit'],
    tone: 'friendly, quick-read',
    length: 'very_short',
  },
  forum_answer: {
    description: 'Helpful answer to a question that naturally leads to our product',
    platforms: ['reddit', 'stackoverflow', 'discord'],
    tone: 'helpful, not salesy, genuine',
    length: 'medium',
  },
};

// Topics relevant to our products
const PRODUCT_TOPICS = {
  'wallet-risk': [
    'How to detect risky wallets before interacting',
    'Red flags in wallet transaction history',
    'Protecting DeFi protocols from bad actors',
    'Wallet risk scoring explained',
    'Why wallet reputation matters in crypto',
  ],
  'webhook-check': [
    'Why payment webhooks fail silently',
    'Monitoring webhook health in production',
    'The cost of missed webhook notifications',
    'Building reliable payment integrations',
    'Webhook retry strategies that actually work',
  ],
  'payment-drift': [
    'Detecting payment discrepancies automatically',
    'Why your received amount doesn\'t match expected',
    'Payment reconciliation for crypto businesses',
    'Finding money leaks in your payment flow',
    'Automated payment monitoring best practices',
  ],
  'guardian': [
    'Autonomous payment protection systems',
    'When manual monitoring isn\'t enough',
    'Building self-healing payment infrastructure',
    'The future of automated financial protection',
  ],
};

interface ContentRequest {
  mode: 'generate' | 'respond' | 'schedule';
  content_type?: keyof typeof CONTENT_TYPES;
  product?: keyof typeof PRODUCT_TOPICS;
  context?: string; // For responding to specific posts
  target_platform?: string;
}

interface GeneratedContent {
  id: string;
  content_type: string;
  platform: string;
  title?: string;
  body: string;
  hashtags?: string[];
  cta?: string;
  product_mentioned: string;
  scheduled_for?: string;
  status: 'draft' | 'approved' | 'published' | 'failed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ========== EMERGENCY STOP CHECK (BEFORE ANYTHING ELSE) ==========
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, emergency_stop')
      .single();

    if (settings?.emergency_stop || !settings?.brain_enabled) {
      console.log('🛑 System stopped: emergency_stop or brain_disabled');
      return new Response(
        JSON.stringify({ success: false, reason: settings?.emergency_stop ? 'emergency_stop' : 'brain_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ContentRequest = await req.json();
    const { mode = 'generate', content_type, product, context, target_platform } = body;

    console.log(`🎨 Content Engine running in ${mode} mode...`);

    const generatedContent: GeneratedContent[] = [];

    if (mode === 'generate') {
      // Generate fresh content for distribution
      const selectedProduct = product || (Object.keys(PRODUCT_TOPICS) as Array<keyof typeof PRODUCT_TOPICS>)[
        Math.floor(Math.random() * Object.keys(PRODUCT_TOPICS).length)
      ];
      
      const topics = PRODUCT_TOPICS[selectedProduct];
      const selectedTopic = topics[Math.floor(Math.random() * topics.length)];
      
      const selectedType = content_type || (Object.keys(CONTENT_TYPES) as Array<keyof typeof CONTENT_TYPES>)[
        Math.floor(Math.random() * 3) // Top 3 types
      ];
      
      const typeConfig = CONTENT_TYPES[selectedType];
      const platform = target_platform || typeConfig.platforms[Math.floor(Math.random() * typeConfig.platforms.length)];

      // Generate content using AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are an expert content creator for a B2B SaaS company that provides API-based security and monitoring tools for crypto/blockchain businesses.

Your task: Create ${typeConfig.description}

CRITICAL RULES:
1. NEVER be promotional or salesy
2. Provide genuine value and insights
3. Sound like a helpful expert, not a marketer
4. Use natural language, no corporate speak
5. Include specific, actionable information
6. If mentioning tools/solutions, do it VERY subtly as "tools like X exist" not "use our product"

Platform: ${platform}
Tone: ${typeConfig.tone}
Length: ${typeConfig.length === 'very_short' ? '50-100 chars' : typeConfig.length === 'short' ? '100-200 chars' : typeConfig.length === 'medium' ? '200-500 chars' : '500-1000 chars'}

Our products (mention subtly or not at all):
- Wallet Risk API: Check if a wallet is risky before interacting
- Webhook Health Check: Verify webhook endpoints are working
- Payment Drift Detector: Find discrepancies between expected and received payments
- Guardian: Automated protection that fixes issues autonomously

Return JSON:
{
  "title": "Title if applicable (for posts that need one)",
  "body": "The main content",
  "hashtags": ["relevant", "hashtags"] // for social media
  "hook": "Why this content should perform well",
  "cta_subtle": "A subtle, non-pushy call to action if appropriate"
}`
            },
            {
              role: 'user',
              content: `Create content about: "${selectedTopic}"

This should naturally relate to ${selectedProduct} without being promotional.
Make it valuable for someone interested in: ${typeConfig.description}`
            }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const contentData = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      const content: GeneratedContent = {
        id: crypto.randomUUID(),
        content_type: selectedType,
        platform,
        title: contentData.title,
        body: contentData.body,
        hashtags: contentData.hashtags,
        cta: contentData.cta_subtle,
        product_mentioned: selectedProduct,
        status: 'draft',
      };

      generatedContent.push(content);

      // Save to database (create table if needed)
      await supabase.from('content_queue').insert({
        id: content.id,
        content_type: content.content_type,
        platform: content.platform,
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
        cta: content.cta,
        product: content.product_mentioned,
        status: content.status,
        created_at: new Date().toISOString(),
      });

      console.log(`✅ Generated ${content.content_type} for ${content.platform}`);

    } else if (mode === 'respond') {
      // Generate response to a specific post/question
      if (!context) {
        throw new Error('Context is required for respond mode');
      }

      const platform = target_platform || 'reddit';

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a helpful expert answering a question on ${platform}. You work in blockchain/crypto infrastructure.

CRITICAL RULES:
1. Be genuinely helpful - answer their actual question first
2. NEVER mention or promote any specific product by name
3. If relevant, you can say "there are tools that do X" but never name them
4. Sound like a real person sharing their experience
5. Keep it concise and practical
6. Show empathy for their problem

Return JSON:
{
  "response": "Your helpful response",
  "approach": "Why you chose this approach",
  "relevance_to_product": "wallet-risk|webhook-check|payment-drift|guardian|none" 
}`
            },
            {
              role: 'user',
              content: `Someone posted this and you want to help them:

"${context}"

Write a genuine, helpful response.`
            }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const responseData = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      const content: GeneratedContent = {
        id: crypto.randomUUID(),
        content_type: 'forum_answer',
        platform,
        body: responseData.response,
        product_mentioned: responseData.relevance_to_product || 'none',
        status: 'draft',
      };

      generatedContent.push(content);

      // Save response
      await supabase.from('content_queue').insert({
        id: content.id,
        content_type: content.content_type,
        platform: content.platform,
        body: content.body,
        product: content.product_mentioned,
        context: context.slice(0, 1000),
        status: content.status,
        created_at: new Date().toISOString(),
      });

    } else if (mode === 'schedule') {
      // Schedule content for the week
      const products = Object.keys(PRODUCT_TOPICS) as Array<keyof typeof PRODUCT_TOPICS>;
      const contentTypes = Object.keys(CONTENT_TYPES) as Array<keyof typeof CONTENT_TYPES>;

      // Generate 7 pieces of content (1 per day)
      for (let day = 0; day < 7; day++) {
        const product = products[day % products.length];
        const contentType = contentTypes[day % contentTypes.length];
        
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + day);
        scheduledDate.setHours(10, 0, 0, 0); // 10 AM

        // Call self recursively to generate
        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/ai-content-engine`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'generate',
            product,
            content_type: contentType,
          }),
        });

        if (generateResponse.ok) {
          const result = await generateResponse.json();
          if (result.content?.[0]) {
            // Update with schedule
            await supabase
              .from('content_queue')
              .update({ 
                scheduled_for: scheduledDate.toISOString(),
                status: 'scheduled',
              })
              .eq('id', result.content[0].id);

            generatedContent.push({
              ...result.content[0],
              scheduled_for: scheduledDate.toISOString(),
            });
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Notify about content generation
    if (generatedContent.length > 0) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `📝 *Content Engine Generated*

${generatedContent.map(c => `• ${c.content_type} for ${c.platform}${c.scheduled_for ? ` (📅 ${new Date(c.scheduled_for).toLocaleDateString()})` : ''}`).join('\n')}

Status: All in draft queue`,
          type: 'content_generated',
        },
      }).catch(() => {/* Silent fail */});
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        content: generatedContent,
        count: generatedContent.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Content Engine error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
