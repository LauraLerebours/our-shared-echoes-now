import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, MapPin, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Memory } from '@/components/MemoryList';
import { getMemory, deleteMemory } from '@/lib/db';
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

const MemoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const accessCode = location.state?.accessCode;
  
  useEffect(() => {
    const loadMemory = async () => {
      if (!id || !accessCode) {
        toast({
          title: "Error",
          description: "Missing required information to load memory",
          variant: "destructive",
        });
        navigate('/boards');
        return;
      }
      
      try {
        const memoryData = await getMemory(id, accessCode);
        
        if (!memoryData) {
          toast({
            title: "Error",
            description: "Memory not found",
            variant: "destructive",
          });
          navigate('/boards');
          return;
        }
        
        setMemory(memoryData);
        setIsLiked(memoryData.isLiked);
        setLikes(memoryData.likes);
      } catch (error) {
        console.error('Error loading memory:', error);
        toast({
          title: "Error",
          description: "Could not load memory details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadMemory();
  }, [id, accessCode, navigate]);

  const handleDelete = async () => {
    if (!memory || !accessCode) return;
    
    try {
      const success = await deleteMemory(memory.id, accessCode);
      
      if (success) {
        toast({
          title: memory.type === 'note' ? "Note deleted" : "Memory deleted",
          description: memory.type === 'note' ? "Your note has been deleted successfully" : "Your memory has been deleted successfully",
        });
        navigate('/boards', { replace: true });
      } else {
        throw new Error('Failed to delete memory');
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      toast({
        title: "Error",
        description: memory?.type === 'note' ? "Could not delete note" : "Could not delete memory",
        variant: "destructive",
      });
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!memory) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p>Memory not found</p>
        <Button asChild className="mt-4">
          <Link to="/boards">Back to boards</Link>
        </Button>
      </div>
    );
  }

  const isNote = memory.type === 'note';
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <h1 className="text-lg font-medium">
          {isNote ? 'Note' : format(memory.date, 'MMMM d, yyyy')}
        </h1>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              size="sm" 
              variant="ghost" 
              className="p-1 h-auto text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {isNote ? 'Note' : 'Memory'}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {isNote ? 'note' : 'memory'}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>
      
      <main className="flex-1">
        {isNote ? (
          // Note layout
          <div className="p-4">
            <div className="bg-gradient-to-r from-memory-lightpurple/10 to-white border-l-4 border-l-memory-purple rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-memory-purple/10 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-memory-purple" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-memory-purple">Note</h2>
                  <p className="text-sm text-muted-foreground">{format(memory.date, 'MMMM d, yyyy')}</p>
                </div>
              </div>
              
              {memory.caption && (
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{memory.caption}</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center border-t py-3">
              <Button 
                variant="ghost" 
                className="p-2 h-auto"
                onClick={() => setIsLiked(!isLiked)}
              >
                <Heart className={cn(
                  "h-6 w-6 mr-1.5", 
                  isLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "font-medium", 
                  isLiked ? "text-memory-pink" : "text-muted-foreground"
                )}>{likes}</span>
              </Button>
            </div>
          </div>
        ) : (
          // Regular memory layout
          <>
            <div className="relative">
              {memory.isVideo ? (
                <video 
                  src={memory.image} 
                  className="w-full aspect-square object-cover" 
                  controls
                />
              ) : (
                <img 
                  src={memory.image} 
                  alt={memory.caption || "Memory"} 
                  className="w-full aspect-square object-cover" 
                />
              )}
            </div>
            
            <div className="p-4">
              {memory.caption && (
                <p className="text-foreground mb-4">{memory.caption}</p>
              )}
              
              {memory.location && (
                <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{memory.location}</span>
                </div>
              )}
              
              <div className="flex items-center border-t py-3 mb-6">
                <Button 
                  variant="ghost" 
                  className="p-2 h-auto"
                  onClick={() => setIsLiked(!isLiked)}
                >
                  <Heart className={cn(
                    "h-6 w-6 mr-1.5", 
                    isLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium", 
                    isLiked ? "text-memory-pink" : "text-muted-foreground"
                  )}>{likes}</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default MemoryDetail;