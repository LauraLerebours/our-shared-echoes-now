import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import { Memory } from '@/components/MemoryList';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemories, deleteMemory, fetchBoards, createBoard, Board } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';

const Index = () => {
  console.log('Index component rendering...');
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  
  console.log('Auth state - Loading:', authLoading, 'User:', user?.email || 'None');
  console.log('Component state - Loading:', loading, 'Memories count:', memories.length, 'Boards count:', boards.length);
  
  // Load boards and memories
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
            setSelectedBoard(defaultBoard.id);
            
            // Load memories for the new board
            const memoriesData = await fetchMemories(defaultBoard.access_code);
            console.log('Memories fetched for new board:', memoriesData.length);
            setMemories(memoriesData);
          } else {
            console.error('Failed to create default board');
            setError('Failed to create default board');
          }
        } else {
          console.log('Setting selected board to first board:', boardsData[0].name);
          setSelectedBoard(boardsData[0].id);
          
          // Load memories for the selected board with timeout
          console.log('Fetching memories for board:', boardsData[0].access_code);
          const memoriesPromise = fetchMemories(boardsData[0].access_code);
          const memoriesTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Memories request timeout')), 10000)
          );
          
          const memoriesData = await Promise.race([memoriesPromise, memoriesTimeoutPromise]) as Memory[];
          console.log('Memories fetched:', memoriesData.length);
          setMemories(memoriesData);
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

  // Load memories when selected board changes
  useEffect(() => {
    const loadMemories = async () => {
      if (!user?.id || !selectedBoard || authLoading || loading) return;
      
      try {
        console.log('Loading memories for selected board:', selectedBoard);
        const selectedBoardData = boards.find(board => board.id === selectedBoard);
        if (selectedBoardData) {
          const data = await fetchMemories(selectedBoardData.access_code);
          console.log('Memories loaded for board:', data.length);
          setMemories(data);
        }
      } catch (error) {
        console.error('Error loading memories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load memories for this board',
          variant: 'destructive',
        });
      }
    };
    
    loadMemories();
  }, [selectedBoard, user?.id, boards, authLoading, loading]);

  const handleCreateBoard = async () => {
    if (!user?.id || !newBoardName.trim()) return;
    
    try {
      setIsCreatingBoard(true);
      console.log('Creating new board:', newBoardName);
      const newBoard = await createBoard(newBoardName.trim(), user.id);
      
      if (newBoard) {
        console.log('Board created successfully:', newBoard.name);
        setBoards([...boards, newBoard]);
        setSelectedBoard(newBoard.id);
        setNewBoardName('');
        toast({
          title: 'Board created',
          description: 'Your new board has been created successfully',
        });
      } else {
        throw new Error('Failed to create board');
      }
    } catch (error) {
      console.error('Error creating board:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new board',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!user?.id || !selectedBoard) return;
    
    try {
      console.log('Deleting memory:', id);
      const selectedBoardData = boards.find(board => board.id === selectedBoard);
      if (!selectedBoardData) return;

      const success = await deleteMemory(id, selectedBoardData.access_code);
      
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
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <Select value={selectedBoard || ''} onValueChange={setSelectedBoard}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a board" />
          </SelectTrigger>
          <SelectContent>
            {boards.map((board) => (
              <SelectItem key={board.id} value={board.id}>
                {board.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Board
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Board</DialogTitle>
              <DialogDescription>
                Give your new memory board a name.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Board name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateBoard}
                disabled={isCreatingBoard || !newBoardName.trim()}
              >
                {isCreatingBoard ? 'Creating...' : 'Create Board'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <main className="flex-1">
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
          <MemoryList memories={memories} onDeleteMemory={handleDeleteMemory} />
        )}
      </main>
      
      <Footer activeTab="timeline" />
    </div>
  );
};

export default Index;