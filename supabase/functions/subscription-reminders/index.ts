import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Calculate dates for 7 days and 3 days from now
    const today = new Date()
    const target7Days = new Date(today)
    target7Days.setDate(today.getDate() + 7)
    
    const target3Days = new Date(today)
    target3Days.setDate(today.getDate() + 3)

    const date7Str = target7Days.toISOString().split('T')[0]
    const date3Str = target3Days.toISOString().split('T')[0]

    // Fetch subscriptions due in exactly 7 days or 3 days
    const { data: subscriptions, error } = await supabaseClient
      .from('subscriptions')
      .select('*, owner:profiles!owner_id(email, name)')
      .in('next_due_date', [date7Str, date3Str])
      .eq('status', 'Active')

    if (error) throw error

    let remindersSent = 0;

    for (const sub of subscriptions || []) {
      const daysUntil = sub.next_due_date === date7Str ? 7 : 3;
      const ownerEmail = sub.owner?.email || 'admin@elitemindz.co'
      
      console.log(`Sending ${daysUntil}-day reminder for ${sub.service_name} to ${ownerEmail}`);

      // Here you would integrate with an Email Provider (SendGrid, Resend, or Google Apps Script)
      // Example calling an external webhook (like the existing Google Webhook):
      /*
      const webhookUrl = Deno.env.get('VITE_GOOGLE_WEBHOOK_URL');
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          body: JSON.stringify({
            type: 'subscription_reminder',
            service_name: sub.service_name,
            cost: sub.cost,
            due_date: sub.next_due_date,
            days_until: daysUntil,
            recipient: ownerEmail
          })
        });
      }
      */
      
      remindersSent++;
    }

    return new Response(
      JSON.stringify({ success: true, remindersSent }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
