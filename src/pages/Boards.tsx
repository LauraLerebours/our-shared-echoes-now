import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BoardMembersDialog from '@/components/BoardMembersDialog';
import BoardRenameDialog from '@/components/BoardRenameDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ScrollToBottom from '@/components/ScrollToBottom';
import { useBoards } from '@/hooks/useBoards';
import { useAuth } from '@/contexts/AuthContext';
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
import { fetchMemories } from '@/lib/db';
import { Memory } from '@/components/MemoryList';

interface BoardWithPreviews {
  id: string;
  name: string;
  created_at: string;
  access_code: string;
  owner_id?: string;
  share_code: string;
  member_ids?: string[];
  recentPhotos: string[];
}

const Boards = () => {
  const [newBoardName, setNewBoardName] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [boardsWithPreviews, setBoardsWithPreviews] = useState<BoardWithPreviews[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const { isSigningOut } = useAuth();

  const {
    boards,
    loading,
    creating,
    removing,
    renaming,
    createBoard,
    removeFromBoard,
    renameBoard
  } = useBoards();

  // Load photo previews for boards
  React.useEffect(() => {
    const loadBoardPreviews = async () => {
      if (boards.length === 0 || isSigningOut) {
        setBoardsWithPreviews([]);
        return;
      }

      setLoadingPreviews(true);
      try {
        const boardsWithPhotos = await Promise.all(
          boards.map(async (board) => {
            try {
              const memories = await fetchMemories(board.access_code);
              
              // Filter to only photo memories (not notes or videos) and get the 4 most recent
              const photoMemories = memories
                .filter(memory => memory.type === 'memory' && !memory.isVideo && memory.image)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 4);

              return {
                ...board,
                recentPhotos: photoMemories.map(memory => memory.image)
              };
            } catch (error) {
              console.error(`Error loading previews for board ${board.name}:`, error);
              return {
                ...board,
                recentPhotos: []
              };
            }
          })
        );

        if (!isSigningOut) {
          setBoardsWithPreviews(boardsWithPhotos);
        }
      } catch (error) {
        console.error('Error loading board previews:', error);
      } finally {
        if (!isSigningOut) {
          setLoadingPreviews(false);
        }
      }
    };

    loadBoardPreviews();
  }, [boards, isSigningOut]);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    
    const result = await createBoard(newBoardName.trim());
    if (result) {
      setNewBoardName('');
    }
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
    const removePromises = Array.from(selectedBoards).map(boardId => 
      removeFromBoard(boardId)
    );
    
    await Promise.all(removePromises);
    setSelectedBoards(new Set());
    setIsSelectionMode(false);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedBoards(new Set());
  };

  const getMemberCount = (board: any) => board.member_ids?.length || 0;

  const PhotoPreview = ({ photos }: { photos: string[] }) => {
    if (photos.length === 0) {
      return (
        <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
          <Image className="h-8 w-8 text-gray-400" />
        </div>
      );
    }

    if (photos.length === 1) {
      return (
        <div className="w-full h-32 rounded-lg overflow-hidden">
          <img 
            src={photos[0]} 
            alt="Board preview" 
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    if (photos.length === 2) {
      return (
        <div className="w-full h-32 rounded-lg overflow-hidden flex gap-0.5">
          {photos.map((photo, index) => (
            <div key={index} className="flex-1 h-full">
              <img 
                src={photo} 
                alt={`Board preview ${index + 1}`} 
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    if (photos.length === 3) {
      return (
        <div className="w-full h-32 rounded-lg overflow-hidden flex gap-0.5">
          <div className="flex-1 h-full">
            <img 
              src={photos[0]} 
              alt="Board preview 1" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex-1">
              <img 
                src={photos[1]} 
                alt="Board preview 2" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <img 
                src={photos[2]} 
                alt="Board preview 3" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      );
    }

    // 4 photos
    return (
      <div className="w-full h-32 rounded-lg overflow-hidden grid grid-cols-2 gap-0.5">
        {photos.map((photo, index) => (
          <div key={index} className="w-full h-full">
            <img 
              src={photo} 
              alt={`Board preview ${index + 1}`} 
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  };

  if (loading && !isSigningOut) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your boards..." />
        </main>
        <Footer activeTab="boards" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main ref={mainRef} className="flex-1 p-4 relative">
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
                        autoComplete="off"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleCreateBoard}
                        disabled={creating || !newBoardName.trim()}
                        className="bg-memory-purple hover:bg-memory-purple/90"
                      >
                        {creating ? 'Creating...' : 'Create Board'}
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
                          disabled={removing}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {removing ? 'Removing...' : `Remove from ${selectedBoards.size} Board(s)`}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from Selected Boards</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove yourself from {selectedBoards.size} board(s)? 
                            If you are the last member of any board, that board and all its memories will be deleted permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleBulkRemove}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={removing}
                          >
                            {removing ? 'Removing...' : 'Remove from Selected'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )}
            
            {boards.length === 0 ? (
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
                        autoComplete="off"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleCreateBoard}
                        disabled={creating || !newBoardName.trim()}
                        className="bg-memory-purple hover:bg-memory-purple/90"
                      >
                        {creating ? 'Creating...' : 'Create Board'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 safari-bottom-safe">
                {boardsWithPreviews.map((board) => (
                  <div
                    key={board.id}
                    className={`bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow ${
                      isSelectionMode && selectedBoards.has(board.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    {/* Photo Preview Section */}
                    <div className="relative">
                      {loadingPreviews ? (
                        <div className="w-full h-32 bg-gray-100 rounded-t-lg flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-memory-purple"></div>
                        </div>
                      ) : (
                        <PhotoPreview photos={board.recentPhotos} />
                      )}
                      
                      {isSelectionMode && (
                        <div className="absolute top-2 right-2">
                          <Checkbox
                            checked={selectedBoards.has(board.id)}
                            onCheckedChange={(checked) => handleBoardSelection(board.id, checked as boolean)}
                            className="bg-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* Board Info Section */}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-semibold">{board.name}</h2>
                            {!isSelectionMode && (
                              <BoardRenameDialog
                                boardId={board.id}
                                currentName={board.name}
                                onRename={(newName) => renameBoard(board.id, newName)}
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
                                disabled={removing}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove from Board</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove yourself from this board? If you are the last member, the board and all its memories will be deleted permanently.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeFromBoard(board.id)}
                                  className="bg-orange-600 hover:bg-orange-700"
                                  disabled={removing}
                                >
                                  {removing ? 'Removing...' : 'Remove from Board'}
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
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Add scroll to bottom component when there are boards */}
          {boards.length > 0 && (
            <ScrollToBottom containerRef={mainRef} />
          )}
        </main>
        
        <Footer activeTab="boards" />
      </div>
    </ErrorBoundary>
  );
};

export default Boards;