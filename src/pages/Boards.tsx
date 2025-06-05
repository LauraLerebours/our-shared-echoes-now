import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Board, fetchBoards, createBoard, deleteBoard } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Boards = () => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadBoards = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const boardsData = await fetchBoards(user.id);
        setBoards(boardsData);
      } catch (error) {
        console.error('Error loading boards:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your boards',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadBoards();
  }, [user]);

  const handleCreateBoard = async () => {
    if (!user || !newBoardName.trim()) return;
    
    try {
      setIsCreatingBoard(true);
      const newBoard = await createBoard(user.id, newBoardName.trim());
      
      if (newBoard) {
        setBoards([...boards, newBoard]);
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

  const handleDeleteBoard = async (boardId: string) => {
    if (!user) return;
    
    try {
      const success = await deleteBoard(boardId, user.id);
      
      if (success) {
        setBoards(boards.filter(board => board.id !== boardId));
        toast({
          title: 'Board deleted',
          description: 'Your board has been deleted successfully',
        });
      }
    } catch (error) {
      console.error('Error deleting board:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete board',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Boards</h1>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading your boards...</p>
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">You haven't created any boards yet.</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Create Your First Board</Button>
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{board.name}</h2>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Board</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this board? All memories in this board will be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteBoard(board.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/', { state: { selectedBoard: board.id } })}
                >
                  View Memories
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default Boards;