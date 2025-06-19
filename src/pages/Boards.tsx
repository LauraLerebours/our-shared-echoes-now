import React, { useState, useRef, useEffect } from 'react';
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
import { Plus, UserMinus, Image, Trash2, CheckSquare, Square, Users, Edit2, Globe, Lock } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchMemories } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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
  is_public?: boolean;
}

const Boards = () => {
  const [newBoardName, setNewBoardName] = useState('');
  const [isPublicBoard, setIsPublicBoard] = useState(false);
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [boardsWithPreviews, setBoardsWithPreviews] = useState<BoardWithPreviews[]>([]);
  const [publicBoards, setPublicBoards] = useState<BoardWithPreviews[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [loadingPublicBoards, setLoadingPublicBoards] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('my-boards');
  const [joiningBoard, setJoiningBoard] = useState<string | null>(null);
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const { isSigningOut, user } = useAuth();

  const {
    boards,
    loading,
    creating,
    removing,
    renaming,
    createBoard,
    removeFromBoard,
    renameBoard,
    refreshBoards
  } = useBoards();

  // Load photo previews for boards
  useEffect(() => {
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
                recentPhotos: photoMemories.map(memory => memory.image),
                is_public: board.is_public || false
              };
            } catch (error) {
              console.error(`Error loading previews for board ${board.name}:`, error);
              return {
                ...board,
                recentPhotos: [],
                is_public: board.is_public || false
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

  // Load public boards
  useEffect(() => {
    const loadPublicBoards = async () => {
      if (isSigningOut || !user) return;
      
      setLoadingPublicBoards(true);
      try {
        // Fetch public boards that the user is not a member of
        const { data, error } = await supabase
          .from('boards')
          .select('*')
          .eq('is_public', true)
          .not('member_ids', 'cs', `{${user.id}}`)
          .not('owner_id', 'eq', user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        // Load previews for public boards
        const publicBoardsWithPreviews = await Promise.all(
          (data || []).map(async (board) => {
            try {
              const memories = await fetchMemories(board.access_code);
              
              // Filter to only photo memories and get the 4 most recent
              const photoMemories = memories
                .filter(memory => memory.type === 'memory' && !memory.isVideo && memory.image)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 4);

              return {
                ...board,
                recentPhotos: photoMemories.map(memory => memory.image)
              };
            } catch (error) {
              console.error(`Error loading previews for public board ${board.name}:`, error);
              return {
                ...board,
                recentPhotos: []
              };
            }
          })
        );
        
        setPublicBoards(publicBoardsWithPreviews);
      } catch (error) {
        console.error('Error loading public boards:', error);
        toast({
          title: 'Error',
          description: 'Failed to load public boards',
          variant: 'destructive',
        });
      } finally {
        setLoadingPublicBoards(false);
      }
    };

    if (activeTab === 'public-boards') {
      loadPublicBoards();
    }
  }, [activeTab, isSigningOut, user]);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    
    try {
      // Create board with is_public flag
      const result = await createBoard(newBoardName.trim(), isPublicBoard);
      if (result) {
        setNewBoardName('');
        setIsPublicBoard(false);
        setCreateDialogOpen(false); // Close the dialog after successful creation
        
        // Show appropriate toast message
        toast({
          title: 'Board created',
          description: isPublicBoard 
            ? 'Your public board has been created successfully' 
            : 'Your private board has been created successfully',
        });
      }
    } catch (error) {
      console.error('Error creating board:', error);
      toast({
        title: 'Error',
        description: 'Failed to create board',
        variant: 'destructive',
      });
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

  const handleJoinBoard = async (boardId: string) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to join boards',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setJoiningBoard(boardId);
    try {
      const board = publicBoards.find(b => b.id === boardId);
      if (!board) {
        throw new Error('Board not found');
      }

      const { data, error } = await supabase.rpc('add_user_to_board_by_share_code', {
        share_code_param: board.share_code,
        user_id_param: user.id
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Success!',
          description: `You've joined "${board.name}"`,
        });
        
        // Refresh boards to show the newly joined board
        refreshBoards();
        
        // Remove the joined board from public boards list
        setPublicBoards(prev => prev.filter(b => b.id !== boardId));
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to join board',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error joining board:', error);
      toast({
        title: 'Error',
        description: 'Failed to join board',
        variant: 'destructive',
      });
    } finally {
      setJoiningBoard(null);
    }
  };

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
              <h1 className="text-2xl font-bold">Boards</h1>
              
              <div className="flex gap-2">
                {boards.length > 0 && activeTab === 'my-boards' && (
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
                
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                        Give your new memory board a name and choose its visibility.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <Input
                        placeholder="Board name"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newBoardName.trim() && !creating) {
                            handleCreateBoard();
                          }
                        }}
                      />
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="public-board"
                          checked={isPublicBoard}
                          onCheckedChange={setIsPublicBoard}
                        />
                        <Label htmlFor="public-board" className="flex items-center gap-2">
                          {isPublicBoard ? (
                            <>
                              <Globe className="h-4 w-4 text-green-500" />
                              <span>Public Board</span>
                              <span className="text-xs text-muted-foreground">(Anyone can find and join)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 text-orange-500" />
                              <span>Private Board</span>
                              <span className="text-xs text-muted-foreground">(Invite only)</span>
                            </>
                          )}
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateDialogOpen(false);
                          setNewBoardName('');
                          setIsPublicBoard(false);
                        }}
                        disabled={creating}
                      >
                        Cancel
                      </Button>
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

            <Tabs defaultValue="my-boards" value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="my-boards" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  My Boards
                </TabsTrigger>
                <TabsTrigger value="public-boards" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Public Boards
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <TabsContent value="my-boards" className="mt-0">
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
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                          Give your new memory board a name and choose its visibility.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <Input
                          placeholder="Board name"
                          value={newBoardName}
                          onChange={(e) => setNewBoardName(e.target.value)}
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newBoardName.trim() && !creating) {
                              handleCreateBoard();
                            }
                          }}
                        />
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="public-board-empty"
                            checked={isPublicBoard}
                            onCheckedChange={setIsPublicBoard}
                          />
                          <Label htmlFor="public-board-empty" className="flex items-center gap-2">
                            {isPublicBoard ? (
                              <>
                                <Globe className="h-4 w-4 text-green-500" />
                                <span>Public Board</span>
                                <span className="text-xs text-muted-foreground">(Anyone can find and join)</span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-4 w-4 text-orange-500" />
                                <span>Private Board</span>
                                <span className="text-xs text-muted-foreground">(Invite only)</span>
                              </>
                            )}
                          </Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCreateDialogOpen(false);
                            setNewBoardName('');
                            setIsPublicBoard(false);
                          }}
                          disabled={creating}
                        >
                          Cancel
                        </Button>
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
                        
                        {/* Public/Private indicator */}
                        <div className="absolute top-2 left-2">
                          {board.is_public ? (
                            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              Public
                            </div>
                          ) : (
                            <div className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full flex items-center">
                              <Lock className="h-3 w-3 mr-1" />
                              Private
                            </div>
                          )}
                        </div>
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
            </TabsContent>

            <TabsContent value="public-boards" className="mt-0">
              {loadingPublicBoards ? (
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner size="lg" text="Loading public boards..." />
                </div>
              ) : publicBoards.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border shadow-sm">
                  <div className="w-16 h-16 bg-memory-lightpurple rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe className="h-8 w-8 text-memory-purple" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">No Public Boards Available</h2>
                  <p className="text-muted-foreground mb-6">There are no public boards available to join at the moment.</p>
                  <p className="text-sm text-muted-foreground">
                    You can create your own public board that others can join!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 safari-bottom-safe">
                  {publicBoards.map((board) => (
                    <div
                      key={board.id}
                      className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow relative"
                    >
                      {/* Photo Preview Section */}
                      <div className="relative">
                        <PhotoPreview photos={board.recentPhotos} />
                        
                        {/* Public indicator */}
                        <div className="absolute top-2 left-2">
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            <Globe className="h-3 w-3 mr-1" />
                            Public
                          </div>
                        </div>
                        
                        {/* Join button */}
                        <Button
                          className="absolute top-2 right-2 bg-memory-purple hover:bg-memory-purple/90 rounded-full w-8 h-8 p-0 flex items-center justify-center"
                          onClick={() => handleJoinBoard(board.id)}
                          disabled={joiningBoard === board.id}
                          title="Join this board"
                        >
                          {joiningBoard === board.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Board Info Section */}
                      <div className="p-4">
                        <div className="mb-4">
                          <h2 className="text-xl font-semibold mb-1">{board.name}</h2>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(board.created_at).toLocaleDateString()}
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
                        
                        <Button 
                          className="w-full bg-memory-purple hover:bg-memory-purple/90"
                          onClick={() => handleJoinBoard(board.id)}
                          disabled={joiningBoard === board.id}
                        >
                          {joiningBoard === board.id ? 'Joining...' : 'Join Board'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
          
          {/* Add scroll to bottom component when there are boards */}
          {(boards.length > 0 || publicBoards.length > 0) && (
            <ScrollToBottom containerRef={mainRef} />
          )}
        </main>
        
        <Footer activeTab="boards" />
      </div>
    </ErrorBoundary>
  );
};

export default Boards;