import React, { useRef, useEffect, useState } from 'react';
import { Heart, Video, User, FileText, Maximize, Minimize, Images } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toggleMemoryLike } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Memory, MediaItem } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CarouselMemory from './CarouselMemory';

interface MemoryGridProps {
  memories: Memory[];
  onViewDetail: (id: string, accessCode: string) => void;
  onUpdateMemory?: (id: string, updates: Partial<Memory>) => void;
}

interface UserProfile {
  id: string;
  name: string;
  profile_picture_url?: string;
}

const VideoPreview: React.FC<{ src: string; alt: string; showFull: boolean }> = ({ src, alt, showFull }) => {
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

      // Start playing the video with error handling
      try {
        video.play().catch(error => {
          // Check if the error is due to media being removed from document
          if (error.message && error.message.includes('media was removed from the document')) {
            // This is expected during component unmounting, so we can safely ignore it
            console.log('ℹ️ Video play interrupted due to component unmounting');
          } else {
            console.error('Video autoplay failed:', error);
          }
        });
      } catch (error) {
        console.error('Video play error:', error);
      }

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      };
    }
  }, [src]);

  return (
    <div className="relative w-full h-full">
      {/* Blurred background for full view */}
      {showFull && (
        <div className="absolute inset-0 z-0">
          <video 
            src={src}
            className="w-full h-full object-cover scale-110 blur-md"
            muted
          />
          <div className="absolute inset-0 bg-black/30"></div>
        </div>
      )}
      <video 
        ref={videoRef}
        src={src}
        className={cn(
          "w-full h-full relative z-10", 
          showFull ? "object-contain" : "object-cover"
        )}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={() => setIsVideoLoaded(true)}
        onError={() => setIsVideoLoaded(false)}
      />
      {/* Video icon overlay - shows initially and fades out */}
      {showVideoIcon && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-1000 z-20">
          <Video className="h-6 w-6 text-white opacity-80" />
        </div>
      )}
      {/* Fallback for when video fails to load */}
      {!isVideoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-20">
          <Video className="h-6 w-6 text-gray-400" />
        </div>
      )}
    </div>
  );
};

const NotePreview: React.FC<{ caption?: string; creatorName?: string; date: Date }> = ({ caption, creatorName, date }) => {
  return (
    <div className="w-full h-full bg-white p-3 flex flex-col justify-between">
      {/* Note content */}
      <div className="flex-1 flex items-center justify-center">
        {caption ? (
          <p className="text-gray-800 text-xs leading-tight line-clamp-4 text-center">
            {caption}
          </p>
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <FileText className="h-6 w-6 mb-1" />
            <p className="text-xs">Empty note</p>
          </div>
        )}
      </div>
      
      {/* Footer with creator and date */}
      <div className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-100">
        <div>{creatorName || 'Unknown'}</div>
        <div>{format(date, 'MMM d')}</div>
      </div>
    </div>
  );
};

const CarouselPreview: React.FC<{ mediaItems: MediaItem[]; showFull: boolean }> = ({ mediaItems, showFull }) => {
  if (!mediaItems || mediaItems.length === 0) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <Images className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <CarouselMemory 
        mediaItems={mediaItems}
        showControls={false}
        autoPlay={true}
        autoPlayInterval={3000}
      />
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center">
        <Images className="h-3 w-3 mr-1" />
        <span>{mediaItems.length}</span>
      </div>
    </div>
  );
};

const MemoryGrid: React.FC<MemoryGridProps> = ({ memories, onViewDetail, onUpdateMemory }) => {
  const [likingMemories, setLikingMemories] = useState<Set<string>>(new Set());
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [showFullImageMap, setShowFullImageMap] = useState<Map<string, boolean>>(new Map());

  // Fetch user profiles for all memory creators
  useEffect(() => {
    const fetchUserProfiles = async () => {
      const creatorIds = [...new Set(memories.map(m => m.createdBy).filter(Boolean))];
      
      if (creatorIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, name, profile_picture_url')
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

  const toggleAspectRatio = (memoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullImageMap(prev => {
      const newMap = new Map(prev);
      newMap.set(memoryId, !prev.get(memoryId));
      return newMap;
    });
  };

  const sortedMemories = [...memories].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 safari-bottom-safe">
        {sortedMemories.map((memory) => {
          const isNote = memory.type === 'note' || memory.memoryType === 'note';
          const isCarousel = memory.memoryType === 'carousel';
          const showFullImage = showFullImageMap.get(memory.id) || false;
          
          return (
            <Tooltip key={memory.id}>
              <TooltipTrigger asChild>
                <div
                  className="aspect-square bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => onViewDetail(memory.id, memory.accessCode)}
                >
                  <div className="relative h-full">
                    {isNote ? (
                      <NotePreview 
                        caption={memory.caption} 
                        creatorName={getCreatorName(memory)}
                        date={memory.date}
                      />
                    ) : isCarousel && memory.mediaItems ? (
                      <CarouselPreview 
                        mediaItems={memory.mediaItems}
                        showFull={showFullImage}
                      />
                    ) : memory.isVideo && memory.image ? (
                      <VideoPreview 
                        src={memory.image} 
                        alt={memory.caption || "Memory"} 
                        showFull={showFullImage}
                      />
                    ) : memory.image ? (
                      <div className="relative w-full h-full">
                        {/* Blurred background for full view */}
                        {showFullImage && (
                          <div className="absolute inset-0 z-0">
                            <img 
                              src={memory.image} 
                              alt="" 
                              className="w-full h-full object-cover scale-110 blur-md"
                            />
                            <div className="absolute inset-0 bg-black/30"></div>
                          </div>
                        )}
                        <img 
                          src={memory.image} 
                          alt={memory.caption || "Memory"} 
                          className={cn(
                            "w-full h-full relative z-10", 
                            showFullImage ? "object-contain" : "object-cover"
                          )} 
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Overlay with info - only show for non-notes */}
                    {!isNote && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {memory.createdBy && (
                                <Avatar className="h-4 w-4">
                                  <AvatarImage 
                                    src={userProfiles.get(memory.createdBy)?.profile_picture_url} 
                                    alt={userProfiles.get(memory.createdBy)?.name || 'Profile'} 
                                  />
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
                    )}

                    {/* Toggle aspect ratio button - for both photos and videos, not for carousels */}
                    {!isNote && !isCarousel && memory.image && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 bg-black/30 hover:bg-black/50 text-white rounded-full h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-30"
                        onClick={(e) => toggleAspectRatio(memory.id, e)}
                        title={showFullImage ? "Show cropped view" : "Show full view"}
                      >
                        {showFullImage ? (
                          <Minimize className="h-3 w-3" />
                        ) : (
                          <Maximize className="h-3 w-3" />
                        )}
                      </Button>
                    )}

                    {/* Like button for notes - positioned differently */}
                    {isNote && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="p-1 h-auto bg-white/90 hover:bg-white rounded-full" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(memory);
                          }}
                          disabled={likingMemories.has(memory.id)}
                        >
                          <Heart className={cn(
                            "h-3 w-3 mr-1", 
                            memory.isLiked ? "fill-memory-pink text-memory-pink" : "text-gray-600"
                          )} />
                          <span className={cn(
                            "text-xs", 
                            memory.isLiked ? "text-memory-pink" : "text-gray-600"
                          )}>{memory.likes}</span>
                        </Button>
                      </div>
                    )}
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