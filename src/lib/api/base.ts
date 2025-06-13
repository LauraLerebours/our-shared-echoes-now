import { supabase } from '@/integrations/supabase/client';
import { ERROR_MESSAGES } from '@/lib/constants';
import { ApiResponse } from '@/lib/types';

// Base API utilities
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiError = (error: any): ApiError => {
  console.error('API Error:', error);
  
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error?.code === 'PGRST116') {
    return new ApiError(ERROR_MESSAGES.NOT_FOUND, 'NOT_FOUND', 404);
  }
  
  if (error?.code === '42501') {
    return new ApiError(ERROR_MESSAGES.UNAUTHORIZED, 'UNAUTHORIZED', 403);
  }
  
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return new ApiError(ERROR_MESSAGES.NETWORK_ERROR, 'NETWORK_ERROR', 0);
  }
  
  return new ApiError(
    error?.message || ERROR_MESSAGES.GENERIC_ERROR,
    'UNKNOWN_ERROR',
    500
  );
};

export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context?: string
): Promise<ApiResponse<T>> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const apiError = handleApiError(error);
    console.error(`Error in ${context || 'API operation'}:`, apiError);
    return { 
      success: false, 
      error: apiError.message,
      message: apiError.message 
    };
  }
};

export const requireAuth = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    throw new ApiError(`Authentication error: ${error.message}`, 'AUTH_ERROR');
  }
  
  if (!user) {
    throw new ApiError('User not authenticated', 'NOT_AUTHENTICATED', 401);
  }
  
  return user.id;
};