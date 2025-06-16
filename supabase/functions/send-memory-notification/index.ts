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

    // Get board members (excluding the creator)
    const { data: board, error: boardError } = await supabaseClient
      .from('boards')
      .select('member_ids, owner_id')
      .eq('id', board_id)
      .single()

    if (boardError) {
      console.error('Error fetching board:', boardError)
      throw boardError
    }

    if (!board || !board.member_ids) {
      console.log('No board members found')
      return new Response(
        JSON.stringify({ success: true, message: 'No members to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get member profiles
    const { data: memberProfiles, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('id, name')
      .in('id', board.member_ids)

    if (profileError) {
      console.error('Error fetching member profiles:', profileError)
      throw profileError
    }

    // Filter out the creator from notifications
    const membersToNotify = memberProfiles?.filter(member => member.id !== board.owner_id) || []

    if (membersToNotify.length === 0) {
      console.log('No other members to notify')
      return new Response(
        JSON.stringify({ success: true, message: 'No other members to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create notification message
    const notificationTitle = `New memory in ${board_name}`
    const notificationBody = memory_caption 
      ? `${creator_name} added: "${memory_caption.substring(0, 100)}${memory_caption.length > 100 ? '...' : ''}"`
      : `${creator_name} added a new memory`

    console.log(`Notifying ${membersToNotify.length} members:`, notificationTitle)

    // In a real implementation, you would send push notifications here
    // For now, we'll just log the notifications that would be sent
    const notifications = membersToNotify.map(member => ({
      user_id: member.id,
      user_name: member.name,
      title: notificationTitle,
      body: notificationBody,
      memory_id,
      board_id,
      board_name
    }))

    console.log('Notifications to send:', notifications)

    // You could integrate with services like:
    // - Firebase Cloud Messaging (FCM)
    // - Apple Push Notification Service (APNs)
    // - Web Push API
    // - Email notifications
    // - In-app notifications

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications prepared for ${membersToNotify.length} members`,
        notifications: notifications.length
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