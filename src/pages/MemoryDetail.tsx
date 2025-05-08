
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, MapPin, Trash2, Video } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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

const MemoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load memories from localStorage
    const savedMemoriesJSON = localStorage.getItem('memories');
    if (savedMemoriesJSON) {
      try {
        const savedMemories = JSON.parse(savedMemoriesJSON);
        const foundMemory = savedMemories.find((memory: any) => memory.id === id);
        if (foundMemory) {
          setMemory(foundMemory);
          setIsLiked(foundMemory.isLiked);
          setLikes(foundMemory.likes);
        }
      } catch (error) {
        console.error('Error parsing saved memories:', error);
        toast({
          title: "Error",
          description: "Could not load memory details",
          variant: "destructive",
        });
      }
    }
    setLoading(false);
  }, [id]);
  
  const toggleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
    setIsLiked(!isLiked);
    
    // Update memory in localStorage
    updateMemoryInLocalStorage({
      ...memory,
      isLiked: !isLiked,
      likes: isLiked ? likes - 1 : likes + 1
    });
  };

  const handleDelete = () => {
    const savedMemoriesJSON = localStorage.getItem('memories');
    if (savedMemoriesJSON) {
      try {
        const savedMemories = JSON.parse(savedMemoriesJSON);
        const updatedMemories = savedMemories.filter((memory: any) => memory.id !== id);
        localStorage.setItem('memories', JSON.stringify(updatedMemories));
        
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
        
        // Navigate back to home
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Error deleting memory:', error);
        toast({
          title: "Error",
          description: "Could not delete memory",
          variant: "destructive",
        });
      }
    }
  };

  const updateMemoryInLocalStorage = (updatedMemory: any) => {
    const savedMemoriesJSON = localStorage.getItem('memories');
    if (savedMemoriesJSON) {
      try {
        const savedMemories = JSON.parse(savedMemoriesJSON);
        const updatedMemories = savedMemories.map((memory: any) => 
          memory.id === id ? updatedMemory : memory
        );
        localStorage.setItem('memories', JSON.stringify(updatedMemories));
      } catch (error) {
        console.error('Error updating memory:', error);
      }
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
          <Link to="/">Back to timeline</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <h1 className="text-lg font-medium">{format(new Date(memory.date), 'MMMM d, yyyy')}</h1>
        
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
              <AlertDialogTitle>Delete Memory</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this memory? This action cannot be undone.
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
              onClick={toggleLike}
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
      </main>
    </div>
  );
};

export default MemoryDetail;
