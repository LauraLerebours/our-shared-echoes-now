import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BoardMembersDialog from '@/components/BoardMembersDialog';
import BoardRenameDialog from '@/components/BoardRenameDialog';
import { Board, fetchBoards, createBoard, removeUserFromBoard } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, UserMinus, Image, Trash2, CheckSquare, Square, Users, Edit2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);
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

  const handleRemoveFromBoard = async (boardId: string) => {
    if (!user?.id || isRemoving) return;
    
    try {
      setIsRemoving(true);
      const result = await removeUserFromBoard(boardId, user.id);
      
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
      console.error('Error removing from board:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from board',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleBoardRename = (boardId: string, newName: string) => {
    setBoards(boards.map(board => 
      board.id === boardId 
        ? { ...board, name: newName }
        : board
    ));
  };

  const handleBoardSelection = (boardId: string, checked: boolean) => {
    const newSelection = new Set(selectedBoards);
    if (checked) {
      newSelection.add(boardId);
    } else {
      newSelection.delete(boardId);
    }
    setSelectedBoards(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedBoards.size === boards.length) {
      setSelectedBoards(new Set());
    } else {
      setSelectedBoards(new Set(boards.map(board => board.id)));
    }
  };

  const handleBulkRemove = async () => {
    if (!user?.id || selectedBoards.size === 0) return;
    
    try {
      setIsBulkRemoving(true);
      const removePromises = Array.from(selectedBoards).map(boardId => 
        removeUserFromBoard(boardId, user.id)
      );
      
      const results = await Promise.all(removePromises);
      const successfulRemovals = results.filter(result => result.success);
      const failedRemovals = results.filter(result => !result.success);
      
      // Update boards list by removing successfully processed boards
      const removedBoardIds = new Set();
      results.forEach((result, index) => {
        if (result.success) {
          removedBoardIds.add(Array.from(selectedBoards)[index]);
        }
      });
      
      setBoards(boards.filter(board => !removedBoardIds.has(board.id)));
      setSelectedBoards(new Set());
      setIsSelectionMode(false);
      
      if (successfulRemovals.length > 0) {
        toast({
          title: 'Success',
          description: `Successfully removed from ${successfulRemovals.length} board(s)`,
        });
      }
      
      if (failedRemovals.length > 0) {
        toast({
          title: 'Partial success',
          description: `Failed to remove from ${failedRemovals.length} board(s)`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error bulk removing from boards:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from selected boards',
        variant: 'destructive',
      });
    } finally {
      setIsBulkRemoving(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedBoards(new Set());
  };

  const getMemberCount = (board: Board) => {
    return board.member_ids?.length || 0;
  };

  const isOwner = (board: Board) => {
    return board.owner_id === user?.id;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">My Boards</h1>
            
            <div className="flex gap-2">
              {boards.length > 0 && (
                <Button
                  variant="outline"
                  onClick={toggleSelectionMode}
                  className={isSelectionMode ? "bg-blue-50 border-blue-300" : ""}
                >
                  {isSelectionMode ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Select
                    </>
                  )}
                </Button>
              )}
              
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
          </div>

          {isSelectionMode && boards.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedBoards.size === boards.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedBoards.size} of {boards.length} boards selected
                  </span>
                </div>
                
                {selectedBoards.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isBulkRemoving}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isBulkRemoving ? 'Removing...' : `Remove from ${selectedBoards.size} Board(s)`}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove from Selected Boards</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove yourself from {selectedBoards.size} board(s)? 
                          If you are the last member of any board, that board and all its memories will be deleted permanently.
                          Otherwise, the boards will remain intact for other members.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkRemove}
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={isBulkRemoving}
                        >
                          {isBulkRemoving ? 'Removing...' : 'Remove from Selected'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}
          
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
                  className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
                    isSelectionMode && selectedBoards.has(board.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                >
                  {isSelectionMode && (
                    <div className="flex justify-end mb-2">
                      <Checkbox
                        checked={selectedBoards.has(board.id)}
                        onCheckedChange={(checked) => handleBoardSelection(board.id, checked as boolean)}
                      />
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-semibold">{board.name}</h2>
                        {isOwner(board) && !isSelectionMode && (
                          <BoardRenameDialog
                            boardId={board.id}
                            currentName={board.name}
                            onRename={(newName) => handleBoardRename(board.id, newName)}
                          >
                            <Button variant="ghost" size="sm" className="p-1 h-auto text-muted-foreground hover:text-memory-purple">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </BoardRenameDialog>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(board.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Share code: <span className="font-mono">{board.share_code}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <BoardMembersDialog boardId={board.id} boardName={board.name}>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-memory-purple p-1 h-auto">
                            <Users className="h-3 w-3 mr-1" />
                            {getMemberCount(board)} member{getMemberCount(board) !== 1 ? 's' : ''}
                          </Button>
                        </BoardMembersDialog>
                      </div>
                    </div>
                    
                    {!isSelectionMode && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-orange-600 hover:bg-orange-50"
                            disabled={isRemoving}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove from Board</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove yourself from this board? If you are the last member, the board and all its memories will be deleted permanently. Otherwise, the board will remain intact for other members.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveFromBoard(board.id)}
                              className="bg-orange-600 hover:bg-orange-700"
                              disabled={isRemoving}
                            >
                              {isRemoving ? 'Removing...' : 'Remove from Board'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  
                  {!isSelectionMode && (
                    <Button 
                      className="w-full bg-memory-purple hover:bg-memory-purple/90"
                      onClick={() => navigate(`/board/${board.id}`)}
                    >
                      View Board
                    </Button>
                  )}
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