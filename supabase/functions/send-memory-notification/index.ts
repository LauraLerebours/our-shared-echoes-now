import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface NotificationRequest {
  memory_id: string
  board_id: string
  creator_name: string
  memory_caption: string
  board_name: string
}

interface ResendEmailRequest {
  from: string
  to: string[]
  subject: string
  html: string
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

    const { memory_id, board_id, creator_name, memory_caption, board_name }: NotificationRequest = await req.json()

    console.log('Sending notification for memory:', { memory_id, board_id, creator_name, board_name })

    // Get board details and members
    const { data: board, error: boardError } = await supabaseClient
      .from('boards')
      .select('member_ids, owner_id')
      .eq('id', board_id)
      .single()

    if (boardError) {
      console.error('Error fetching board:', boardError)
      throw boardError
    }

    if (!board || !board.member_ids || board.member_ids.length === 0) {
      console.log('No board members found')
      return new Response(
        JSON.stringify({ success: true, message: 'No members to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profiles and auth data for all members
    const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching auth users:', authError)
      throw authError
    }

    const { data: memberProfiles, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('id, name')
      .in('id', board.member_ids)

    if (profileError) {
      console.error('Error fetching member profiles:', profileError)
      throw profileError
    }

    // Get creator's user ID from auth
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser()
    const creatorUserId = currentUser?.id

    // Filter out the creator from notifications and get email addresses
    const membersToNotify = memberProfiles
      ?.filter(member => member.id !== creatorUserId)
      .map(member => {
        const authUser = authUsers.users.find(user => user.id === member.id)
        return {
          id: member.id,
          name: member.name,
          email: authUser?.email
        }
      })
      .filter(member => member.email) || []

    if (membersToNotify.length === 0) {
      console.log('No other members to notify')
      return new Response(
        JSON.stringify({ success: true, message: 'No other members to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if Resend API key is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY environment variable not set')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create email content
    const subject = `New memory in ${board_name}`
    const memoryPreview = memory_caption 
      ? memory_caption.substring(0, 150) + (memory_caption.length > 150 ? '...' : '')
      : 'A new memory has been added'

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .container {
              background: white;
              border-radius: 12px;
              padding: 32px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 32px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              background: linear-gradient(135deg, #FFA5BA, #9b87f5);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              margin-bottom: 8px;
            }
            .title {
              font-size: 24px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 16px;
            }
            .content {
              margin-bottom: 32px;
            }
            .memory-card {
              background: linear-gradient(135deg, #FFA5BA20, #9b87f520);
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              border-left: 4px solid #9b87f5;
            }
            .creator {
              font-weight: 600;
              color: #9b87f5;
              margin-bottom: 8px;
            }
            .board-name {
              font-weight: 500;
              color: #6b7280;
              margin-bottom: 12px;
            }
            .memory-text {
              font-style: italic;
              color: #4b5563;
              line-height: 1.5;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #FFA5BA, #9b87f5);
              color: white;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #6b7280;
              font-size: 14px;
              margin-top: 32px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
            @media (max-width: 600px) {
              body {
                padding: 10px;
              }
              .container {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">This Is Us</div>
              <div class="title">${subject}</div>
            </div>
            
            <div class="content">
              <div class="memory-card">
                <div class="creator">${creator_name}</div>
                <div class="board-name">in "${board_name}"</div>
                <div class="memory-text">"${memoryPreview}"</div>
              </div>
              
              <p>A new memory has been added to your shared board. Open the app to view it and add your own memories!</p>
              
              <div style="text-align: center;">
                <a href="https://thisisus.space" class="cta-button">
                  View Memory
                </a>
              </div>
            </div>
            
            <div class="footer">
              <p>You're receiving this because you're a member of the "${board_name}" board.</p>
              <p>This Is Us - Shared Memories</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send emails using Resend
    const emailAddresses = membersToNotify.map(member => member.email).filter(Boolean) as string[]
    
    const emailData: ResendEmailRequest = {
      from: 'This Is Us <notifications@thisisus.space>',
      to: emailAddresses,
      subject: subject,
      html: emailHtml
    }

    console.log(`Sending email to ${emailAddresses.length} recipients`)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    const resendResult = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult)
      throw new Error(`Failed to send email: ${resendResult.message || 'Unknown error'}`)
    }

    console.log('Email sent successfully:', resendResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email notifications sent to ${emailAddresses.length} members`,
        email_id: resendResult.id,
        recipients: emailAddresses.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-memory-notification function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})