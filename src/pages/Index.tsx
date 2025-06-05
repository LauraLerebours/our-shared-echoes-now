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
  const [memories, setMemories] = useState<Memory[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const { user } = useAuth();
  
  // Load boards and memories
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Load boards first
        const boardsData = await fetchBoards();
        setBoards(boardsData);
        
        // If there are no boards, create a default one
        if (boardsData.length === 0) {
          const defaultBoard = await createBoard('My Memories');
          if (defaultBoard) {
            setBoards([defaultBoard]);
            setSelectedBoard(defaultBoard.id);
          }
        } else {
          setSelectedBoard(boardsData[0].id);
        }
        
        // Load memories for the selected board
        if (boardsData.length > 0) {
          const selectedBoardData = boardsData[0];
          const memoriesData = await fetchMemories(selectedBoardData.access_code);
          setMemories(memoriesData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your memories',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user]);

  // Load memories when selected board changes
  useEffect(() => {
    const loadMemories = async () => {
      if (!user || !selectedBoard) return;
      
      try {
        const selectedBoardData = boards.find(board => board.id === selectedBoard);
        if (selectedBoardData) {
          const data = await fetchMemories(selectedBoardData.access_code);
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
  }, [selectedBoard, user, boards]);

  const handleCreateBoard = async () => {
    if (!user || !newBoardName.trim()) return;
    
    try {
      setIsCreatingBoard(true);
      const newBoard = await createBoard(newBoardName.trim());
      
      if (newBoard) {
        setBoards([...boards, newBoard]);
        setSelectedBoard(newBoard.id);
        setNewBoardName('');
        toast({
          title: 'Board created',
          description: 'Your new board has been created successfully',
        });
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
    if (!user || !selectedBoard) return;
    
    try {
      const selectedBoardData = boards.find(board => board.id === selectedBoard);
      if (!selectedBoardData) return;

      const success = await deleteMemory(id, selectedBoardData.access_code);
      
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