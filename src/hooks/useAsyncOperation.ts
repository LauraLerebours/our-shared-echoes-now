import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { ApiResponse } from '@/lib/types';

interface UseAsyncOperationOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export function useAsyncOperation<T extends any[], R>(
  operation: (...args: T) => Promise<ApiResponse<R> | R>,
  options: UseAsyncOperationOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    showSuccessToast = true,
    showErrorToast = true
  } = options;

  const execute = useCallback(async (...args: T): Promise<R | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await operation(...args);
      
      // Handle both direct results and ApiResponse wrapped results
      let data: R;
      let success: boolean;
      let errorMsg: string | undefined;

      if (result && typeof result === 'object' && 'success' in result) {
        // It's an ApiResponse
        const apiResult = result as ApiResponse<R>;
        success = apiResult.success;
        data = apiResult.data as R;
        errorMsg = apiResult.error;
      } else {
        // It's a direct result
        success = true;
        data = result as R;
      }

      if (!success) {
        throw new Error(errorMsg || 'Operation failed');
      }
      
      if (successMessage && showSuccessToast) {
        toast({
          title: 'Success',
          description: successMessage,
        });
      }
      
      onSuccess?.();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      if (showErrorToast) {
        toast({
          title: 'Error',
          description: options.errorMessage || errorMessage,
          variant: 'destructive',
        });
      }
      
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, [operation, options]);

  return { execute, loading, error };
}