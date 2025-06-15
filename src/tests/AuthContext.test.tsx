import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      })),
      signOut: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}));

// Mock toast notifications
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { user, loading, signIn, signUp, signOut, updateProfile } = useAuth();
  
  return (
    <div>
      <div data-testid="loading-state">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user-state">{user ? 'User Authenticated' : 'No User'}</div>
      <button 
        data-testid="sign-in-button" 
        onClick={() => signIn('test@example.com', 'password123')}
      >
        Sign In
      </button>
      <button 
        data-testid="sign-up-button" 
        onClick={() => signUp('test@example.com', 'password123', 'Test User')}
      >
        Sign Up
      </button>
      <button 
        data-testid="sign-out-button" 
        onClick={() => signOut()}
      >
        Sign Out
      </button>
      <button 
        data-testid="update-profile-button" 
        onClick={() => updateProfile('Updated Name')}
      >
        Update Profile
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Default mock for getSession - no session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state and no user', async () => {
    // Render the test component wrapped in AuthProvider
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initially should be in loading state
    expect(screen.getByTestId('loading-state').textContent).toBe('Loading');
    
    // After initialization, loading should be false and no user
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('Not Loading');
      expect(screen.getByTestId('user-state').textContent).toBe('No User');
    });
  });

  it('should sign in a user successfully', async () => {
    // Mock successful sign in
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockSession = { user: mockUser };
    
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null
    });
    
    // Mock user profile fetch
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: mockUser.id, name: 'Test User' },
            error: null
          })
        })
      }),
      upsert: vi.fn(),
      update: vi.fn()
    } as any);

    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('Not Loading');
    });

    // Click sign in button
    const user = userEvent.setup();
    await user.click(screen.getByTestId('sign-in-button'));

    // Verify sign in was called
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });

    // Mock auth state change to simulate successful sign in
    const authStateChangeMock = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    
    // Manually trigger the auth state change callback
    await act(async () => {
      authStateChangeMock('SIGNED_IN', { user: mockUser } as any);
    });

    // User should now be authenticated
    await waitFor(() => {
      expect(screen.getByTestId('user-state').textContent).toBe('User Authenticated');
    });
  });

  it('should sign up a user successfully', async () => {
    // Mock successful sign up
    const mockUser = { id: 'new-user-id', email: 'test@example.com' };
    
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null
    });
    
    // Mock profile creation
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' }
          })
        })
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: mockUser.id, name: 'Test User' },
            error: null
          })
        })
      }),
      update: vi.fn()
    } as any);

    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('Not Loading');
    });

    // Click sign up button
    const user = userEvent.setup();
    await user.click(screen.getByTestId('sign-up-button'));

    // Verify sign up was called
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: {
          name: 'Test User'
        }
      }
    });
  });

  it('should sign out a user successfully', async () => {
    // Mock an authenticated user
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockSession = { user: mockUser };
    
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    
    // Mock successful sign out
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: null
    });
    
    // Mock user profile fetch
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: mockUser.id, name: 'Test User' },
            error: null
          })
        })
      }),
      upsert: vi.fn(),
      update: vi.fn()
    } as any);

    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for user to be authenticated
    await waitFor(() => {
      expect(screen.getByTestId('user-state').textContent).toBe('User Authenticated');
    });

    // Click sign out button
    const user = userEvent.setup();
    await user.click(screen.getByTestId('sign-out-button'));

    // Verify sign out was called
    expect(supabase.auth.signOut).toHaveBeenCalled();

    // Mock auth state change to simulate sign out
    const authStateChangeMock = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    
    // Manually trigger the auth state change callback
    await act(async () => {
      authStateChangeMock('SIGNED_OUT', null);
    });

    // User should now be signed out
    await waitFor(() => {
      expect(screen.getByTestId('user-state').textContent).toBe('No User');
    });
  });

  it('should update user profile successfully', async () => {
    // Mock an authenticated user
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockSession = { user: mockUser };
    
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    
    // Mock user profile fetch and update
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: mockUser.id, name: 'Test User' },
            error: null
          })
        })
      }),
      upsert: vi.fn(),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockUser.id, name: 'Updated Name' },
              error: null
            })
          })
        })
      })
    } as any);

    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for user to be authenticated
    await waitFor(() => {
      expect(screen.getByTestId('user-state').textContent).toBe('User Authenticated');
    });

    // Click update profile button
    const user = userEvent.setup();
    await user.click(screen.getByTestId('update-profile-button'));

    // Verify profile update was called
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    });
  });

  it('should handle sign in errors', async () => {
    // Mock sign in error
    const mockError = { message: 'Invalid login credentials', status: 400 };
    
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: mockError
    });

    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('Not Loading');
    });

    // Click sign in button
    const user = userEvent.setup();
    await user.click(screen.getByTestId('sign-in-button'));

    // Verify sign in was called
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });

    // User should still be unauthenticated
    await waitFor(() => {
      expect(screen.getByTestId('user-state').textContent).toBe('No User');
    });
  });
});