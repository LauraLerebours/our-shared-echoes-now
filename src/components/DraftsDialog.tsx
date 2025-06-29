import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileEdit, Trash2, Calendar, MapPin, FileText, Video, Image, Images } from 'lucide-react';
import { format } from 'date-fns';
import { getDrafts, deleteDraft, clearAllDrafts } from '@/lib/draftsStorage';
import { Draft } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
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

interface DraftsDialogProps {
  children: React.ReactNode;
  onDraftSelected?: () => void;
}

const DraftsDialog: React.FC<DraftsDialogProps> = ({ children, onDraftSelected }) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      loadDrafts();
    }
  }, [open]);

  const loadDrafts = () => {
    const loadedDrafts = getDrafts();
    setDrafts(loadedDrafts);
  };

  const handleEditDraft = (draft: Draft) => {
    navigate('/add', { state: { draftId: draft.id, boardId: draft.board_id } });
    setOpen(false);
    if (onDraftSelected) {
      onDraftSelected();
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      setIsDeleting(id);
      deleteDraft(id);
      setDrafts(drafts.filter(draft => draft.id !== id));
      toast({
        title: "Draft deleted",
        description: "Your draft has been deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Error",
        description: "Failed to delete draft",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClearAllDrafts = async () => {
    try {
      setIsClearingAll(true);
      await clearAllDrafts();
      setDrafts([]);
      toast({
        title: "Drafts cleared",
        description: "All drafts have been deleted successfully",
      });
    } catch (error) {
      console.error('Error clearing drafts:', error);
      toast({
        title: "Error",
        description: "Failed to clear drafts",
        variant: "destructive",
      });
    } finally {
      setIsClearingAll(false);
    }
  };

  const getMemoryTypeIcon = (memoryType?: string) => {
    switch (memoryType) {
      case 'photo':
        return <Image className="h-4 w-4 text-blue-500" />;
      case 'video':
        return <Video className="h-4 w-4 text-red-500" />;
      case 'note':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'carousel':
        return <Images className="h-4 w-4 text-purple-500" />;
      default:
        return <FileEdit className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPreviewImage = (draft: Draft) => {
    if (draft.memory.memoryType === 'note') {
      return null;
    }
    
    if (draft.memory.memoryType === 'carousel' && draft.mediaItems && draft.mediaItems.length > 0) {
      return draft.mediaItems[0].preview || draft.mediaItems[0].url;
    }
    
    return draft.memory.image;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your Drafts</DialogTitle>
          <DialogDescription>
            Continue working on your saved drafts or delete them.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] overflow-y-auto pr-4">
          {drafts.length === 0 ? (
            <div className="py-8 text-center">
              <FileEdit className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No drafts found</p>
              <p className="text-xs text-muted-foreground mt-2">
                Drafts are automatically saved when you add media to a memory
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {drafts.map((draft) => (
                <div 
                  key={draft.id} 
                  className="border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex">
                    {/* Preview image */}
                    {getPreviewImage(draft) ? (
                      <div className="w-24 h-24 flex-shrink-0">
                        {draft.memory.memoryType === 'video' || 
                         (draft.memory.memoryType === 'carousel' && 
                          draft.mediaItems && 
                          draft.mediaItems[0]?.isVideo) ? (
                          <div className="w-full h-full bg-black flex items-center justify-center">
                            <Video className="h-8 w-8 text-white/70" />
                          </div>
                        ) : (
                          <img 
                            src={getPreviewImage(draft)} 
                            alt="Draft preview" 
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                        {getMemoryTypeIcon(draft.memory.memoryType)}
                      </div>
                    )}
                    
                    {/* Draft info */}
                    <div className="flex-1 p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            {getMemoryTypeIcon(draft.memory.memoryType)}
                            <span className="text-sm font-medium">
                              {draft.memory.memoryType?.charAt(0).toUpperCase() + draft.memory.memoryType?.slice(1) || 'Memory'}
                            </span>
                          </div>
                          
                          {draft.memory.caption && (
                            <p className="text-sm text-gray-600 line-clamp-1 mb-1">
                              {draft.memory.caption}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {draft.memory.date && (
                              <div className="flex items-center text-xs text-gray-500">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span>{format(draft.memory.date, 'MMM d, yyyy')}</span>
                              </div>
                            )}
                            
                            {draft.memory.location && (
                              <div className="flex items-center text-xs text-gray-500">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span className="truncate max-w-[100px]">{draft.memory.location}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-xs text-gray-400 mt-1">
                            Last edited: {format(draft.lastUpdated, 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditDraft(draft)}
                          >
                            <FileEdit className="h-4 w-4 text-memory-purple" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive"
                                disabled={isDeleting === draft.id}
                              >
                                {isDeleting === draft.id ? (
                                  <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this draft? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDraft(draft.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          
          {drafts.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="text-destructive border-destructive hover:bg-destructive/10"
                  disabled={isClearingAll}
                >
                  {isClearingAll ? (
                    <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {isClearingAll ? 'Clearing...' : 'Clear All Drafts'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Drafts</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete all your drafts? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllDrafts}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DraftsDialog;