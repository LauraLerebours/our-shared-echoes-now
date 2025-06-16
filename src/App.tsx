import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Index from "./pages/Index";
import AddMemory from "./pages/AddMemory";
import MemoryDetail from "./pages/MemoryDetail";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Share from "./pages/Share";
import SharedMemories from "./pages/SharedMemories";
import Boards from "./pages/Boards";
import BoardView from "./pages/BoardView";
import Welcome from "./pages/Welcome";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        console.log('🔄 Query retry attempt:', failureCount, error);
        // Retry up to 3 times for network errors
        if (failureCount < 3) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  console.log('🔄 ProtectedRoute check:', { user: !!user, loading });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-memory-purple mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    console.log('❌ No user found, redirecting to welcome');
    return <Navigate to="/welcome" replace />;
  }
  
  console.log('✅ User authenticated, rendering protected content');
  return <>{children}</>;
};

const App = () => {
  console.log('🚀 App component rendering');
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/shared/:code" element={<SharedMemories />} />
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/boards" 
                  element={
                    <ProtectedRoute>
                      <Boards />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/board/:boardId" 
                  element={
                    <ProtectedRoute>
                      <BoardView />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/add" 
                  element={
                    <ProtectedRoute>
                      <AddMemory />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/memory/:id" 
                  element={
                    <ProtectedRoute>
                      <MemoryDetail />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/share" 
                  element={
                    <ProtectedRoute>
                      <Share />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;