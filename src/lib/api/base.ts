
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
    console.log(`🔄 ${operationName}: Starting operation`);
    const result = await operation();
    console.log(`✅ ${operationName}: Operation completed successfully`);
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`❌ ${operationName}: ${errorMessage}`, error);
    return { success: false, error: errorMessage };
  }
}

export function requireAuth(userId?: string): string {
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}
