export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<ApiResponse<T>> {
  try {
    console.log(`🔄 [${operationName}] Starting operation`);
    const result = await operation();
    console.log(`✅ [${operationName}] Operation completed successfully`);
    return { success: true, data: result };
  } catch (error) {
    // Check if this is an AbortError (from fetch abort)
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request aborted')) {
      console.log(`🛑 [${operationName}] Operation aborted by user`);
      return { success: false, error: 'Operation aborted by user' };
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`❌ [${operationName}] ${errorMessage}`, error);
    return { success: false, error: errorMessage };
  }
}

export function requireAuth(userId?: string): string {
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}

// Retry utility for transient errors
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if the operation has been aborted
      if (signal?.aborted) {
        console.log(`🛑 [withRetry] Operation aborted before attempt ${attempt}`);
        throw new Error('Operation aborted by user');
      }
      
      console.log(`🔄 [withRetry] Attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      // If the operation was aborted, rethrow immediately
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request aborted' || error.message === 'Operation aborted by user')) {
        console.log(`🛑 [withRetry] Operation aborted during attempt ${attempt}`);
        throw error;
      }
      
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ [withRetry] Attempt ${attempt} failed:`, lastError.message);
      
      // Check if the signal was aborted during the operation
      if (signal?.aborted) {
        console.log(`🛑 [withRetry] Operation aborted after attempt ${attempt} failed`);
        throw new Error('Operation aborted by user');
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        console.log(`❌ [withRetry] All ${maxRetries} attempts failed`);
        break;
      }
      
      // Check if error is retryable
      const isRetryable = lastError.message.includes('timeout') ||
                         lastError.message.includes('network') ||
                         lastError.message.includes('connection') ||
                         lastError.message.includes('ECONNRESET') ||
                         lastError.message.includes('ETIMEDOUT');
      
      if (!isRetryable) {
        console.log(`❌ [withRetry] Error is not retryable, giving up:`, lastError.message);
        break;
      }
      
      console.log(`⏳ [withRetry] Retrying operation in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
      
      // Check again if the operation was aborted during the delay
      if (signal?.aborted) {
        console.log(`🛑 [withRetry] Operation aborted during retry delay`);
        throw new Error('Operation aborted by user');
      }
    }
  }
  
  throw lastError!;
}

// Parallel processing utility
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  chunkSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkPromises = chunk.map((item, index) => 
      processor(item, i + index).catch(error => {
        console.warn(`Failed to process item at index ${i + index}:`, error);
        return null; // Return null for failed items
      })
    );
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults.filter(result => result !== null));
  }
  
  return results;
}