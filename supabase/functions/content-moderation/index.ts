import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Google Cloud Vision API key
const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY') || '';

// Content moderation function using Google Cloud Vision API
async function moderateImage(imageUrl: string): Promise<{
  isAppropriate: boolean;
  moderationResults: any;
  error?: string;
}> {
  try {
    // Prepare the request to Google Cloud Vision API
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`;
    
    const requestBody = {
      requests: [
        {
          image: {
            source: {
              imageUri: imageUrl
            }
          },
          features: [
            {
              type: "SAFE_SEARCH_DETECTION",
              maxResults: 1
            }
          ]
        }
      ]
    };
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Vision API error: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Check if we have safe search annotations
    if (!data.responses?.[0]?.safeSearchAnnotation) {
      throw new Error('No safe search annotations found in the response');
    }
    
    const safeSearch = data.responses[0].safeSearchAnnotation;
    
    // Determine if the image is appropriate based on safe search results
    // Reject if any category is LIKELY or VERY_LIKELY for adult, violence, medical, or racy content
    const inappropriateCategories = ['adult', 'violence', 'medical', 'racy'];
    const inappropriateLevels = ['LIKELY', 'VERY_LIKELY'];
    
    let isAppropriate = true;
    const flaggedCategories = [];
    
    for (const category of inappropriateCategories) {
      if (inappropriateLevels.includes(safeSearch[category])) {
        isAppropriate = false;
        flaggedCategories.push(category);
      }
    }
    
    // Special case for "gore" and "spoof" - only reject if VERY_LIKELY
    if (safeSearch.gore === 'VERY_LIKELY') {
      isAppropriate = false;
      flaggedCategories.push('gore');
    }
    
    return {
      isAppropriate,
      moderationResults: {
        safeSearch,
        flaggedCategories
      }
    };
  } catch (error) {
    console.error('Error in content moderation:', error);
    return {
      isAppropriate: false, // Fail closed for safety
      moderationResults: null,
      error: error.message
    };
  }
}

// Function to moderate video content
// For videos, we'll check the thumbnail frame
async function moderateVideo(videoUrl: string): Promise<{
  isAppropriate: boolean;
  moderationResults: any;
  error?: string;
}> {
  try {
    // For videos, we'll generate a thumbnail and check that
    // This is a simplified approach - production systems might check multiple frames
    
    // Generate a thumbnail URL from the video
    // This assumes your video URL is from Supabase storage and we can modify it to get a thumbnail
    // For a real implementation, you might need to extract a frame from the video
    
    // For now, we'll use a simple approach of checking the video thumbnail
    // In a production system, you would want to analyze multiple frames
    
    const thumbnailUrl = videoUrl + '?thumbnail=true';
    
    // Use the same image moderation function for the thumbnail
    return await moderateImage(thumbnailUrl);
  } catch (error) {
    console.error('Error in video moderation:', error);
    return {
      isAppropriate: false, // Fail closed for safety
      moderationResults: null,
      error: error.message
    };
  }
}

// Main handler function
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Parse the request body
    const { mediaUrl, isVideo } = await req.json();
    
    if (!mediaUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Media URL is required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    // Perform content moderation based on media type
    const moderationResult = isVideo 
      ? await moderateVideo(mediaUrl)
      : await moderateImage(mediaUrl);
    
    // Return the moderation results
    return new Response(
      JSON.stringify({
        success: true,
        isAppropriate: moderationResult.isAppropriate,
        moderationResults: moderationResult.moderationResults,
        error: moderationResult.error
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to process content moderation request: ' + error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
})