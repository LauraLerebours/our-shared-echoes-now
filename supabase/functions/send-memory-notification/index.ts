import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  memory_id: string;
  board_id: string;
  creator_name: string;
  memory_caption: string;
  board_name: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { memory_id, board_id, creator_name, memory_caption, board_name }: NotificationPayload = await req.json()

    // Get all board members except the creator
    const { data: board, error: boardError } = await supabaseClient
      .from('boards')
      .select('member_ids, owner_id')
      .eq('id', board_id)
      .single()

    if (boardError) {
      throw new Error(`Failed to fetch board: ${boardError.message}`)
    }

    // Get the creator's user ID to exclude them from notifications
    const { data: creatorProfile, error: creatorError } = await supabaseClient
      .from('user_profiles')
      .select('id')
      .eq('name', creator_name)
      .single()

    if (creatorError) {
      console.warn('Could not find creator profile:', creatorError.message)
    }

    const creatorId = creatorProfile?.id

    // Get member IDs excluding the creator
    const memberIds = board.member_ids?.filter(id => id !== creatorId) || []

    if (memberIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No members to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get email addresses for all members
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers()

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    // Filter users to only include board members
    const memberEmails = users.users
      .filter(user => memberIds.includes(user.id))
      .map(user => user.email)
      .filter(email => email) // Remove any undefined emails

    if (memberEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No valid email addresses found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send emails to all members
    const emailPromises = memberEmails.map(async (email) => {
      try {
        // Using Resend with custom domain
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'This Is Us <notifications@thisisus.space>',
            to: [email],
            subject: `New memory added to "${board_name}"`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #FFA5BA 0%, #9b87f5 100%); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">This Is Us</h1>
                  <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">Shared Memories</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 32px; background: white; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
                  <div style="text-align: center; margin-bottom: 32px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FFA5BA 0%, #9b87f5 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 28px;">📸</span>
                    </div>
                    <h2 style="color: #1a1a1a; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">New Memory Added!</h2>
                    <p style="color: #666; font-size: 16px; margin: 0; line-height: 1.5;">
                      <strong style="color: #9b87f5;">${creator_name}</strong> just shared a new memory in "<strong>${board_name}</strong>"
                    </p>
                  </div>
                  
                  ${memory_caption ? `
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #9b87f5;">
                      <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.6; font-style: italic;">"${memory_caption}"</p>
                    </div>
                  ` : ''}
                  
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://thisisus.space/memory/${memory_id}" 
                       style="display: inline-block; background: linear-gradient(135deg, #FFA5BA 0%, #9b87f5 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(155, 135, 245, 0.3); transition: all 0.2s ease;">
                      View Memory
                    </a>
                  </div>
                  
                  <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.5;">
                      Keep building your shared story together! ❤️
                    </p>
                  </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                  <p style="margin: 0 0 8px 0; font-weight: 500;">This Is Us - Shared Memories</p>
                  <p style="margin: 0;">You received this email because you're a member of the "${board_name}" board.</p>
                  <p style="margin: 8px 0 0 0;">
                    <a href="https://thisisus.space" style="color: #9b87f5; text-decoration: none;">Visit This Is Us</a>
                  </p>
                </div>
              </div>
            `,
          }),
        })

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error(`Failed to send email to ${email}:`, errorText)
          return { email, success: false, error: errorText }
        }

        return { email, success: true }
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error)
        return { email, success: false, error: error.message }
      }
    })

    const results = await Promise.all(emailPromises)
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        message: `Notification emails sent`,
        success_count: successCount,
        failure_count: failureCount,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-memory-notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})