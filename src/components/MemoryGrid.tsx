import React, { useRef, useEffect, useState } from 'react';
import { Heart, Video, User, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toggleMemoryLike } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Memory } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MemoryGridProps {
  memories: Memory[];
  onViewDetail: (id: string, accessCode: string) => void;
  onUpdateMemory?: (id: string, updates: Partial<Memory>) => void;
}

interface UserProfile {
  id: string;
  name: string;
}

const VideoPreview: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showVideoIcon, setShowVideoIcon] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      const handleLoadedData = () => {
        setIsVideoLoaded(true);
        // Hide the video icon after a short delay once video starts playing
        setTimeout(() => {
          setShowVideoIcon(false);
        }, 1000);
      };

      const handleError = () => {
        console.error('Video failed to load');
        setIsVideoLoaded(false);
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);

      // Start playing the video
      video.play().catch(error => {
        console.error('Video autoplay failed:', error);
      });

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      };
    }
  }, [src]);

  return (
    <div className="relative w-full h-full">
      <video 
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover" 
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={() => setIsVideoLoaded(true)}
        onError={() => setIsVideoLoaded(false)}
      />
      {/* Video icon overlay - shows initially and fades out */}
      {showVideoIcon && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-1000">
          <Video className="h-6 w-6 text-white opacity-80" />
        </div>
      )}
      {/* Fallback for when video fails to load */}
      {!isVideoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <Video className="h-6 w-6 text-gray-400" />
        </div>
      )}
    </div>
  );
};

const NotePreview: React.FC<{ caption?: string }> = ({ caption }) => {
  return (
    <div className="w-full h-full bg-gradient-to-br from-memory-lightpurple to-memory-peach p-3 flex flex-col justify-center items-center relative">
      <FileText className="h-8 w-8 text-memory-purple mb-2" />
      <div className="text-center">
        <p className="text-memory-purple font-medium text-sm mb-1">Note</p>
        {caption && (
          <p className="text-gray-700 text-xs line-clamp-3 max-w-full">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
};

const MemoryGrid: React.FC<MemoryGridProps> = ({ memories, onViewDetail, onUpdateMemory }) => {
  const [likingMemories, setLikingMemories] = useState<Set<string>>(new Set());
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());

  // Fetch user profiles for all memory creators
  useEffect(() => {
    const fetchUserProfiles = async () => {
      const creatorIds = [...new Set(memories.map(m => m.createdBy).filter(Boolean))];
      
      if (creatorIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', creatorIds);

        if (error) {
          console.error('Error fetching user profiles:', error);
          return;
        }

        const profileMap = new Map<string, UserProfile>();
        data.forEach(profile => {
          profileMap.set(profile.id, profile);
        });
        setUserProfiles(profileMap);
      } catch (error) {
        console.error('Error fetching user profiles:', error);
      }
    };

    fetchUserProfiles();
  }, [memories]);

  const handleLike = async (memory: Memory) => {
    if (likingMemories.has(memory.id)) return;

    // Optimistically update UI
    const newIsLiked = !memory.isLiked;
    const newLikes = newIsLiked ? memory.likes + 1 : memory.likes - 1;
    
    if (onUpdateMemory) {
      onUpdateMemory(memory.id, {
        likes: newLikes,
        isLiked: newIsLiked
      });
    }

    setLikingMemories(prev => new Set(prev).add(memory.id));
    
    try {
      const result = await toggleMemoryLike(memory.id, memory.accessCode);
      
      if (result && result.success) {
        if (onUpdateMemory) {
          onUpdateMemory(memory.id, {
            likes: result.likes,
            isLiked: result.isLiked
          });
        }
        
        toast({
          title: result.isLiked ? "Liked!" : "Unliked",
          description: result.isLiked ? "You liked this memory" : "You removed your like",
        });
      } else {
        // Revert to original values if API call fails
        if (onUpdateMemory) {
          onUpdateMemory(memory.id, {
            likes: memory.likes,
            isLiked: memory.isLiked
          });
        }
        
        toast({
          title: "Error",
          description: "Failed to update like. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert to original values
      if (onUpdateMemory) {
        onUpdateMemory(memory.id, {
          likes: memory.likes,
          isLiked: memory.isLiked
        });
      }
      
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
    if (!memory.createdBy) return 'U';
    const profile = userProfiles.get(memory.createdBy);
    if (!profile?.name) return 'U';
    
    return profile.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCreatorName = (memory: Memory) => {
    if (!memory.createdBy) return 'Unknown User';
    const profile = userProfiles.get(memory.createdBy);
    return profile?.name || 'Unknown User';
  };

  const sortedMemories = [...memories].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 safari-bottom-safe">
        {sortedMemories.map((memory) => {
          const isNote = memory.type === 'note' || memory.memoryType === 'note';
          
          return (
            <Tooltip key={memory.id}>
              <TooltipTrigger asChild>
                <div
                  className="aspect-square bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => onViewDetail(memory.id, memory.accessCode)}
                >
                  <div className="relative h-full">
                    {isNote ? (
                      <NotePreview caption={memory.caption} />
                    ) : memory.isVideo && memory.image ? (
                      <VideoPreview src={memory.image} alt={memory.caption || "Memory"} />
                    ) : memory.image ? (
                      <img 
                        src={memory.image} 
                        alt={memory.caption || "Memory"} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
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
              </TooltipTrigger>
              <TooltipContent>
                <p>Posted by {getCreatorName(memory)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default MemoryGrid;