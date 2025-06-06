import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Board, fetchBoards, createBoard, deleteBoard } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, UserMinus, Image } from 'lucide-react';
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
      if (!user?.id) return;
      
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
  }, [user?.id]);

  const handleCreateBoard = async () => {
    if (!user?.id || !newBoardName.trim()) return;
    
    try {
      setIsCreatingBoard(true);
      const newBoard = await createBoard(newBoardName.trim(), user.id);
      
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

  const handleLeaveBoard = async (boardId: string) => {
    if (!user?.id) return;
    
    try {
      const result = await deleteBoard(boardId, user.id);
      
      if (result.success) {
        setBoards(boards.filter(board => board.id !== boardId));
        toast({
          title: 'Success',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error leaving board:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave board',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">My Boards</h1>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-memory-purple hover:bg-memory-purple/90">
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
                    className="bg-memory-purple hover:bg-memory-purple/90"
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
            <div className="text-center py-12 bg-white rounded-lg border shadow-sm">
              <div className="w-16 h-16 bg-memory-lightpurple rounded-full flex items-center justify-center mx-auto mb-4">
                <Image className="h-8 w-8 text-memory-purple" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Boards Yet</h2>
              <p className="text-muted-foreground mb-6">Create your first board to start organizing your memories.</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-memory-purple hover:bg-memory-purple/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Board
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
                      className="bg-memory-purple hover:bg-memory-purple/90"
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
                    <div>
                      <h2 className="text-xl font-semibold mb-1">{board.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(board.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Share code: <span className="font-mono">{board.share_code}</span>
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50">
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Leave Board</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to leave this board? If you are the last member, the board and all its memories will be deleted permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleLeaveBoard(board.id)}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            Leave Board
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <Button 
                    className="w-full bg-memory-purple hover:bg-memory-purple/90"
                    onClick={() => navigate(`/board/${board.id}`)}
                  >
                    View Board
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <Footer activeTab="boards" />
    </div>
  );
};

export default Boards;