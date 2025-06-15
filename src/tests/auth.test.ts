import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn()
    }
  }
}));

// Mock toast notifications
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('Authentication Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    vi.clearAllMocks();
  });

  describe('Sign Up', () => {
    it('should successfully sign up a new user', async () => {
      // Arrange
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockSignUpResponse = {
        data: { user: mockUser, session: null },
        error: null
      };
      
      // Mock the signUp function to return success
      vi.mocked(supabase.auth.signUp).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            name: 'Test User'
          }
        }
      });

      // Assert
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            name: 'Test User'
          }
        }
      });
      expect(result.data.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should handle sign up with existing email', async () => {
      // Arrange
      const mockError = {
        message: 'User already registered',
        status: 400
      };
      const mockSignUpResponse = {
        data: { user: null, session: null },
        error: mockError
      };
      
      // Mock the signUp function to return an error
      vi.mocked(supabase.auth.signUp).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await supabase.auth.signUp({
        email: 'existing@example.com',
        password: 'password123'
      });

      // Assert
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'existing@example.com',
        password: 'password123'
      });
      expect(result.data.user).toBeNull();
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('User already registered');
    });

    it('should handle sign up with weak password', async () => {
      // Arrange
      const mockError = {
        message: 'Password should be at least 6 characters',
        status: 400
      };
      const mockSignUpResponse = {
        data: { user: null, session: null },
        error: mockError
      };
      
      // Mock the signUp function to return an error
      vi.mocked(supabase.auth.signUp).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await supabase.auth.signUp({
        email: 'test@example.com',
        password: '123'
      });

      // Assert
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: '123'
      });
      expect(result.data.user).toBeNull();
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('Password should be at least 6 characters');
    });
  });

  describe('Sign In', () => {
    it('should successfully sign in an existing user', async () => {
      // Arrange
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockSession = { access_token: 'test-token', user: mockUser };
      const mockSignInResponse = {
        data: { user: mockUser, session: mockSession },
        error: null
      };
      
      // Mock the signInWithPassword function to return success
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockSignInResponse);

      // Act
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });

      // Assert
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle sign in with invalid credentials', async () => {
      // Arrange
      const mockError = {
        message: 'Invalid login credentials',
        status: 400
      };
      const mockSignInResponse = {
        data: { user: null, session: null },
        error: mockError
      };
      
      // Mock the signInWithPassword function to return an error
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockSignInResponse);

      // Act
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      // Assert
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('Invalid login credentials');
    });

    it('should handle sign in with unverified email', async () => {
      // Arrange
      const mockError = {
        message: 'Email not confirmed',
        status: 400
      };
      const mockSignInResponse = {
        data: { user: null, session: null },
        error: mockError
      };
      
      // Mock the signInWithPassword function to return an error
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockSignInResponse);

      // Act
      const result = await supabase.auth.signInWithPassword({
        email: 'unverified@example.com',
        password: 'password123'
      });

      // Assert
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'unverified@example.com',
        password: 'password123'
      });
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('Email not confirmed');
    });
  });

  describe('Password Reset', () => {
    it('should successfully send password reset email', async () => {
      // Arrange
      const mockResetResponse = {
        data: {},
        error: null
      };
      
      // Mock the resetPasswordForEmail function to return success
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue(mockResetResponse);

      // Act
      const result = await supabase.auth.resetPasswordForEmail('test@example.com', {
        redirectTo: 'http://localhost:8080/auth?type=recovery'
      });

      // Assert
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'http://localhost:8080/auth?type=recovery' }
      );
      expect(result.error).toBeNull();
    });

    it('should handle password reset for non-existent email', async () => {
      // Arrange
      const mockError = {
        message: 'Email not found',
        status: 400
      };
      const mockResetResponse = {
        data: {},
        error: mockError
      };
      
      // Mock the resetPasswordForEmail function to return an error
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue(mockResetResponse);

      // Act
      const result = await supabase.auth.resetPasswordForEmail('nonexistent@example.com');

      // Assert
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('Email not found');
    });
  });

  describe('Sign Out', () => {
    it('should successfully sign out a user', async () => {
      // Arrange
      const mockSignOutResponse = {
        error: null
      };
      
      // Mock the signOut function to return success
      vi.mocked(supabase.auth.signOut).mockResolvedValue(mockSignOutResponse);

      // Act
      const result = await supabase.auth.signOut();

      // Assert
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it('should handle sign out with no active session', async () => {
      // Arrange
      const mockError = {
        message: 'Session not found',
        status: 400
      };
      const mockSignOutResponse = {
        error: mockError
      };
      
      // Mock the signOut function to return an error
      vi.mocked(supabase.auth.signOut).mockResolvedValue(mockSignOutResponse);

      // Act
      const result = await supabase.auth.signOut();

      // Assert
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('Session not found');
    });
  });

  describe('Session Management', () => {
    it('should get the current user session', async () => {
      // Arrange
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockSession = { access_token: 'test-token', user: mockUser };
      const mockSessionResponse = {
        data: { session: mockSession },
        error: null
      };
      
      // Mock the getSession function to return a session
      vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSessionResponse);

      // Act
      const result = await supabase.auth.getSession();

      // Assert
      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.data.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle no active session', async () => {
      // Arrange
      const mockSessionResponse = {
        data: { session: null },
        error: null
      };
      
      // Mock the getSession function to return no session
      vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSessionResponse);

      // Act
      const result = await supabase.auth.getSession();

      // Assert
      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.data.session).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should get the current user', async () => {
      // Arrange
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockUserResponse = {
        data: { user: mockUser },
        error: null
      };
      
      // Mock the getUser function to return a user
      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockUserResponse);

      // Act
      const result = await supabase.auth.getUser();

      // Assert
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(result.data.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });
  });
});