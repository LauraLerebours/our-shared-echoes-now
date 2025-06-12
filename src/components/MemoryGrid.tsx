import React from 'react';
import { Memory } from './MemoryList';
import { Heart, Video, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toggleMemoryLike } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

interface MemoryGridProps {
  memories: Memory[];
  onViewDetail: (id: string, accessCode: string) => void;
  onUpdateMemory?: (id: string, updates: Partial<Memory>) => void;
}

const MemoryGrid: React.FC<MemoryGridProps> = ({ memories, onViewDetail, onUpdateMemory }) => {
  const [likingMemories, setLikingMemories] = useState<Set<string>>(new Set());

  const handleLike = async (memory: Memory) => {
    if (likingMemories.has(memory.id)) return;

    setLikingMemories(prev => new Set(prev).add(memory.id));
    
    try {
      const result = await toggleMemoryLike(memory.id, memory.accessCode);
      
      if (result && result.success && onUpdateMemory) {
        onUpdateMemory(memory.id, {
          likes: result.likes,
          isLiked: result.isLiked
        });
        
        toast({
          title: result.isLiked ? "Liked!" : "Unliked",
          description: result.isLiked ? "You liked this memory" : "You removed your like",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update like. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLikingMemories(prev => {
        const newSet = new Set(prev);
        newSet.delete(memory.id);
        return newSet;
      });
    }
  };

  const getCreatorInitials = (memory: Memory) => {
    // This would need to be enhanced to fetch actual user profile data
    return 'U';
  };

  const sortedMemories = [...memories].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 pb-20">
      {sortedMemories.map((memory) => {
        const isNote = memory.type === 'note';
        
        if (isNote) {
          // Note card in grid
          return (
            <div
              key={memory.id}
              className="aspect-square bg-gradient-to-br from-memory-lightpurple/20 to-white border border-memory-purple/20 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow flex flex-col"
              onClick={() => onViewDetail(memory.id, memory.accessCode)}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-memory-purple" />
                <span className="text-xs text-memory-purple font-medium">Note</span>
              </div>
              <p className="text-xs text-foreground line-clamp-4 flex-1">
                {memory.caption}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-memory-purple/10">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(memory.date), 'MMM d')}
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="p-0 h-auto" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(memory);
                  }}
                  disabled={likingMemories.has(memory.id)}
                >
                  <Heart className={cn(
                    "h-3 w-3 mr-1", 
                    memory.isLiked ? "fill-memory-pink text-memory-pink" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs", 
                    memory.isLiked ? "text-memory-pink" : "text-muted-foreground"
                  )}>{memory.likes}</span>
                </Button>
              </div>
            </div>
          );
        }

        // Regular memory card in grid
        return (
          <div
            key={memory.id}
            className="aspect-square bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onViewDetail(memory.id, memory.accessCode)}
          >
            <div className="relative h-full">
              {memory.isVideo ? (
                <div className="relative h-full">
                  <video 
                    src={memory.image}
                    className="w-full h-full object-cover" 
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Video className="h-6 w-6 text-white opacity-80" />
                  </div>
                </div>
              ) : (
                <img 
                  src={memory.image} 
                  alt={memory.caption || "Memory"} 
                  className="w-full h-full object-cover" 
                />
              )}
              
              {/* Overlay with info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {memory.createdBy && (
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="bg-white/20 text-white text-xs">
                            {getCreatorInitials(memory)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-white text-xs">
                        {format(new Date(memory.date), 'MMM d')}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="p-0 h-auto" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(memory);
                      }}
                      disabled={likingMemories.has(memory.id)}
                    >
                      <Heart className={cn(
                        "h-3 w-3 mr-1", 
                        memory.isLiked ? "fill-memory-pink text-memory-pink" : "text-white"
                      )} />
                      <span className={cn(
                        "text-xs", 
                        memory.isLiked ? "text-memory-pink" : "text-white"
                      )}>{memory.likes}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MemoryGrid;