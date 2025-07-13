import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  memory_id: string;
  comment_id: string;
  commenter_name: string;
  comment_content: string;
  memory_caption?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting send-comment-notification function');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created with URL:', Deno.env.get('SUPABASE_URL')?.substring(0, 20) + '...');
    
    const { memory_id, comment_id, commenter_name, comment_content, memory_caption }: NotificationPayload = await req.json()

    console.log('Received payload:', { memory_id, comment_id, commenter_name });
    
    // Get the memory details to find the owner
    const { data: memory, error: memoryError } = await supabaseClient
      .from('memories')
      .select('created_by, caption, access_code')
      .eq('id', memory_id)
      .single()

    if (memoryError) {
      console.error('Failed to fetch memory:', memoryError);
      throw new Error(`Failed to fetch memory: ${memoryError.message}`)
    }

    if (!memory.created_by) {
      console.log('Memory has no owner to notify');
      return new Response(
        JSON.stringify({ message: 'Memory has no owner to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Memory owner found:', memory.created_by.substring(0, 8) + '...');
    
    // Get the board name for context
    const { data: board, error: boardError } = await supabaseClient
      .from('boards')
      .select('name')
      .eq('access_code', memory.access_code)
      .single()

    if (boardError) {
      console.warn('Could not fetch board name:', boardError.message)
    }

    const boardName = board?.name || 'Shared Board'
    console.log('Board name:', boardName);

    // Get the owner's email
    const { data: ownerData, error: ownerError } = await supabaseClient.auth.admin.getUserById(
      memory.created_by
    )

    if (ownerError) {
      console.error('Failed to fetch owner:', ownerError);
      throw new Error(`Failed to fetch owner: ${ownerError.message}`)
    }

    const ownerEmail = ownerData.user.email
    if (!ownerEmail) {
      console.log('Owner has no email address');
      return new Response(
        JSON.stringify({ message: 'Owner has no email address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Owner email found:', ownerEmail.substring(0, 3) + '***@***' + ownerEmail.split('@')[1]);

    // Truncate comment content if too long
    const truncatedComment = comment_content.length > 150 
      ? comment_content.substring(0, 147) + '...' 
      : comment_content

    // Truncate memory caption if too long
    const truncatedCaption = memory.caption && memory.caption.length > 100
      ? memory.caption.substring(0, 97) + '...'
      : memory.caption

    try {
      console.log('Preparing to send email notification');
      
      // Check if Resend API key is available
      const resendApiKey = Deno.env.get('SUPABASE_RESEND_API_KEY') || Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        console.error('No Resend API key found in environment variables');
        throw new Error('Missing Resend API key');
      }
      
      console.log('Resend API key available:', resendApiKey.substring(0, 3) + '***');
      
      // Using Resend API for email sending
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Amity <notifications@amity.space>',
          to: [ownerEmail],
          subject: `${commenter_name} commented on your memory`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #FFA5BA 0%, #9b87f5 100%); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Amity</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">New Comment Notification</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 32px; background: white; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FFA5BA 0%, #9b87f5 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 28px;">💬</span>
                  </div>
                  <h2 style="color: #1a1a1a; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">New Comment</h2>
                  <p style="color: #666; font-size: 16px; margin: 0; line-height: 1.5;">
                    <strong style="color: #9b87f5;">${commenter_name}</strong> commented on your memory in "<strong>${boardName}</strong>"
                  </p>
                </div>
                
                ${truncatedCaption ? `
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #9b87f5;">
                    <p style="margin: 0 0 12px 0; color: #333; font-size: 14px; line-height: 1.6; font-style: italic;">Your memory:</p>
                    <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.6;">"${truncatedCaption}"</p>
                  </div>
                ` : ''}
                
                <div style="background: #f0f4f9; padding: 20px; border-radius: 12px; margin: 24px 0;">
                  <p style="margin: 0 0 12px 0; color: #333; font-size: 14px; line-height: 1.6; font-style: italic;">${commenter_name}'s comment:</p>
                  <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.6;">"${truncatedComment}"</p>
                </div>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="https://amity.space" 
                     style="display: inline-block; background: linear-gradient(135deg, #FFA5BA 0%, #9b87f5 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(155, 135, 245, 0.3); transition: all 0.2s ease;">
                    View Comment
                  </a>
                </div>
                
                <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.5;">
                    Keep the conversation going! 💬
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                <p style="margin: 0 0 8px 0; font-weight: 500;">Amity - Shared Memories</p>
                <p style="margin: 0;">You received this email because someone commented on your memory.</p>
                <p style="margin: 8px 0 0 0;">
                  <a href="https://amity.space" style="color: #9b87f5; text-decoration: none;">Visit Amity App</a>
                </p>
              </div>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        const statusCode = emailResponse.status;
        console.error(`Failed to send email to ${ownerEmail.substring(0, 3)}***@***: Status ${statusCode}, Error:`, errorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorText,
            status: statusCode,
            message: `Email sending failed with status ${statusCode}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully sent comment notification email to ${ownerEmail.substring(0, 3)}***@***`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Comment notification email sent successfully',
          recipient: ownerEmail.substring(0, 3) + '***@***' + ownerEmail.split('@')[1]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      console.error('Error sending email:', error.message || error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message || 'Unknown error',
          details: typeof error === 'object' ? Object.keys(error).join(', ') : 'No details available'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error) {
    console.error('Error in send-comment-notification function:', error.message || error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})