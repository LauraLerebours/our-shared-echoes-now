
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import { Memory } from '@/components/MemoryList';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemories, deleteMemory } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Load memories from Supabase when the component mounts
  useEffect(() => {
    const loadMemories = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const data = await fetchMemories(user.id);
        setMemories(data);
      } catch (error) {
        console.error('Error loading memories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load memories',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadMemories();
  }, [user]);

  const handleDeleteMemory = async (id: string) => {
    if (!user) return;
    
    try {
      const success = await deleteMemory(id, user.id);
      
      if (success) {
        const updatedMemories = memories.filter(memory => memory.id !== id);
        setMemories(updatedMemories);
        
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete memory',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete memory',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading your memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : (
          <MemoryList memories={memories} onDeleteMemory={handleDeleteMemory} />
        )}
      </main>
      
      <Footer activeTab="timeline" />
    </div>
  );
};

export default Index;
