
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import ScrollToBottom from '@/components/ScrollToBottom';
import { Memory } from '@/components/MemoryList';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemories, deleteMemory, fetchBoards, createBoard, Board } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  console.log('Index component rendering...');
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  
  console.log('Auth state - Loading:', authLoading, 'User:', user?.email || 'None');
  console.log('Component state - Loading:', loading, 'Memories count:', memories.length, 'Boards count:', boards.length);
  
  // Load boards and all memories
  useEffect(() => {
    console.log('useEffect running - loadData');
    const loadData = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        console.log('Auth still loading, waiting...');
        return;
      }

      if (!user?.id) {
        console.log('No user found, skipping data load');
        setLoading(false);
        return;
      }
      
      try {
        console.log('Starting data load for user:', user.id);
        setLoading(true);
        setError(null);
        
        // Load boards first with timeout
        console.log('Fetching boards...');
        const boardsPromise = fetchBoards(user.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );
        
        const boardsData = await Promise.race([boardsPromise, timeoutPromise]) as Board[];
        console.log('Boards fetched:', boardsData.length, 'boards');
        setBoards(boardsData);
        
        // If there are no boards, create a default one
        if (boardsData.length === 0) {
          console.log('No boards found, creating default board...');
          const defaultBoard = await createBoard('My Memories', user.id);
          if (defaultBoard) {
            console.log('Default board created:', defaultBoard.name);
            setBoards([defaultBoard]);
            
            // Load memories for the new board
            const memoriesData = await fetchMemories(defaultBoard.access_code);
            console.log('Memories fetched for new board:', memoriesData.length);
            setMemories(memoriesData);
          } else {
            console.error('Failed to create default board');
            setError('Failed to create default board');
          }
        } else {
          // Load memories from all boards
          console.log('Loading memories from all boards...');
          const allMemories: Memory[] = [];
          
          for (const board of boardsData) {
            try {
              console.log('Fetching memories for board:', board.name, board.access_code);
              const boardMemories = await fetchMemories(board.access_code);
              console.log('Memories fetched for board', board.name, ':', boardMemories.length);
              allMemories.push(...boardMemories);
            } catch (error) {
              console.error(`Error loading memories for board ${board.name}:`, error);
              // Continue loading other boards even if one fails
            }
          }
          
          console.log('Total memories loaded from all boards:', allMemories.length);
          setMemories(allMemories);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load your memories';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        console.log('Data load complete, setting loading to false');
        setLoading(false);
      }
    };
    
    loadData();
  }, [user?.id, authLoading]);

  const handleDeleteMemory = async (id: string) => {
    if (!user?.id) return;
    
    try {
      console.log('Deleting memory:', id);
      // Find which board this memory belongs to
      const memory = memories.find(m => m.id === id);
      if (!memory) return;

      const success = await deleteMemory(id, memory.accessCode);
      
      if (success) {
        const updatedMemories = memories.filter(memory => memory.id !== id);
        setMemories(updatedMemories);
        console.log('Memory deleted successfully');
        
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
      } else {
        throw new Error('Failed to delete memory');
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

  console.log('About to render UI. Auth Loading:', authLoading, 'Loading:', loading, 'Error:', error, 'User:', user?.email || 'None');

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-memory-purple mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main ref={mainRef} className="flex-1 relative">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-memory-purple mx-auto mb-4"></div>
              <p>Loading your memories...</p>
            </div>
          </div>
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <MemoryList memories={memories} onDeleteMemory={handleDeleteMemory} />
            <ScrollToBottom containerRef={mainRef} />
          </>
        )}
      </main>
      
      <Footer activeTab="timeline" />
    </div>
  );
};

export default Index;
