// Security utilities for Supabase operations
import { supabase } from '@/integrations/supabase/client';

/**
 * Validates that the current user is authenticated
 * @returns Promise<string> - Returns the user ID if authenticated
 * @throws Error if user is not authenticated
 */
export const requireAuth = async (): Promise<string> => {
  try {
    console.log('🔄 Checking authentication...');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Authentication error:', error);
      throw new Error(`Authentication error: ${error.message}`);
    }
    
    if (!user) {
      console.error('❌ No authenticated user found');
      throw new Error('User not authenticated');
    }
    
    console.log('✅ User authenticated:', user.id);
    return user.id;
  } catch (error) {
    console.error('❌ requireAuth failed:', error);
    throw error;
  }
};

/**
 * Validates that a user has access to a specific board
 * @param boardId - The board ID to check access for
 * @param userId - The user ID to check
 * @returns Promise<boolean> - Returns true if user has access
 */
export const validateBoardAccess = async (boardId: string, userId: string): Promise<boolean> => {
  try {
    console.log('🔄 Validating board access:', { boardId, userId });
    
    const { data, error } = await supabase
      .from('boards')
      .select('owner_id, member_ids')
      .eq('id', boardId)
      .single();
    
    if (error) {
      console.error('❌ Board access validation error:', error);
      return false;
    }
    
    // Check if user is owner
    if (data.owner_id === userId) {
      console.log('✅ User is board owner');
      return true;
    }
    
    // Check if user is in member_ids array
    if (data.member_ids && Array.isArray(data.member_ids)) {
      const isMember = data.member_ids.includes(userId);
      console.log('✅ User membership check:', isMember);
      return isMember;
    }
    
    console.log('❌ User has no access to board');
    return false;
  } catch (error) {
    console.error('❌ Board access validation error:', error);
    return false;
  }
};

/**
 * Validates that a user owns a specific board
 * @param boardId - The board ID to check ownership for
 * @param userId - The user ID to check
 * @returns Promise<boolean> - Returns true if user owns the board
 */
export const validateBoardOwnership = async (boardId: string, userId: string): Promise<boolean> => {
  try {
    console.log('🔄 Validating board ownership:', { boardId, userId });
    
    const { data, error } = await supabase
      .from('boards')
      .select('owner_id')
      .eq('id', boardId)
      .eq('owner_id', userId)
      .single();
    
    if (error) {
      console.error('❌ Board ownership validation error:', error);
      return false;
    }
    
    const isOwner = !!data;
    console.log('✅ Board ownership check:', isOwner);
    return isOwner;
  } catch (error) {
    console.error('❌ Board ownership validation error:', error);
    return false;
  }
};

/**
 * Sanitizes user input to prevent injection attacks
 * @param input - The input string to sanitize
 * @returns string - The sanitized input
 */
export const sanitizeInput = (input: string): string => {
  const sanitized = input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
  
  console.log('🧹 Input sanitized:', { original: input.length, sanitized: sanitized.length });
  return sanitized;
};

/**
 * Validates that an access code format is correct
 * @param code - The access code to validate
 * @returns boolean - Returns true if format is valid
 */
export const validateAccessCodeFormat = (code: string): boolean => {
  // Access codes should be 6 characters, alphanumeric, uppercase
  const accessCodeRegex = /^[A-Z0-9]{6}$/;
  const isValid = accessCodeRegex.test(code);
  
  if (!isValid) {
    console.warn('⚠️ Invalid access code format:', code);
  }
  
  return isValid;
};

/**
 * Rate limiting helper - simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      console.warn('⚠️ Rate limit exceeded for:', identifier);
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }
}

export const rateLimiter = new RateLimiter();