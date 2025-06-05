import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Index from "./pages/Index";
import AddMemory from "./pages/AddMemory";
import AddNote from "./pages/AddNote";
import MemoryDetail from "./pages/MemoryDetail";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Share from "./pages/Share";
import SharedMemories from "./pages/SharedMemories";
import Boards from "./pages/Boards";

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
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
              path="/add" 
              element={
                <ProtectedRoute>
                  <AddMemory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/add-note" 
              element={
                <ProtectedRoute>
                  <AddNote />
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
);

export default App;