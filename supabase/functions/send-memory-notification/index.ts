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
        // Using a simple email service - you can replace this with your preferred email provider
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
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #FFA5BA, #9b87f5); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">This Is Us</h1>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <h2 style="color: #333; margin-top: 0;">New Memory Added! 📸</h2>
                  
                  <p style="color: #666; font-size: 16px; line-height: 1.5;">
                    <strong>${creator_name}</strong> just added a new memory to your shared board "<strong>${board_name}</strong>".
                  </p>
                  
                  ${memory_caption ? `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #9b87f5;">
                      <p style="margin: 0; color: #555; font-style: italic;">"${memory_caption}"</p>
                    </div>
                  ` : ''}
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://thisisus.space/memory/${memory_id}" 
                       style="background: linear-gradient(135deg, #FFA5BA, #9b87f5); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      View Memory
                    </a>
                  </div>
                  
                  <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
                    Keep building your shared story together! ❤️
                  </p>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                  <p>This Is Us - Shared Memories</p>
                  <p>You received this email because you're a member of the "${board_name}" board.</p>
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