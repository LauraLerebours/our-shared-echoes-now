import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MediaItem } from '@/lib/types';

interface CarouselMemoryProps {
  mediaItems: MediaItem[];
  onMediaItemClick?: (index: number) => void;
  showControls?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
}

const CarouselMemory: React.FC<CarouselMemoryProps> = ({
  mediaItems,
  onMediaItemClick,
  showControls = true,
  autoPlay = false,
  autoPlayInterval = 5000,
  className
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  
  // Set up refs for videos
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, mediaItems.length);
  }, [mediaItems]);

  // Auto play functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && mediaItems.length > 1) {
      interval = setInterval(() => {
        goToNext();
      }, autoPlayInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentIndex, autoPlayInterval, mediaItems.length]);

  // Handle video playback when current slide changes
  useEffect(() => {
    // Pause all videos first
    videoRefs.current.forEach(videoRef => {
      if (videoRef) {
        videoRef.pause();
      }
    });
    
    // Play the current video if it's a video
    const currentItem = mediaItems[currentIndex];
    if (currentItem?.isVideo && videoRefs.current[currentIndex]) {
      const videoRef = videoRefs.current[currentIndex];
      if (videoRef) {
        videoRef.currentTime = 0;
        videoRef.play().catch(error => {
          console.error('Error playing video:', error);
        });
      }
    }
  }, [currentIndex, mediaItems]);

  const goToPrevious = () => {
    setCurrentIndex(prevIndex => 
      prevIndex === 0 ? mediaItems.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex(prevIndex => 
      prevIndex === mediaItems.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  // Touch event handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  // If no media items, show placeholder
  if (!mediaItems || mediaItems.length === 0) {
    return (
      <div className={cn("relative aspect-square bg-gray-100 flex items-center justify-center", className)}>
        <p className="text-gray-400">No media items</p>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative aspect-square overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="flex transition-transform duration-300 ease-in-out h-full"
        style={{ 
          width: `${mediaItems.length * 100}%`, 
          transform: `translateX(-${currentIndex * (100 / mediaItems.length)}%)` 
        }}
      >
        {mediaItems.map((item, index) => (
          <div 
            key={item.id} 
            className="relative flex-shrink-0"
            style={{ width: `${100 / mediaItems.length}%` }}
            onClick={() => onMediaItemClick && onMediaItemClick(index)}
          >
            {item.isVideo ? (
              <video
                ref={el => videoRefs.current[index] = el}
                src={item.url}
                className="w-full h-full object-cover"
                playsInline
                loop
                muted
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <img
                src={item.url}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-cover"
                onClick={e => e.stopPropagation()}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      {showControls && mediaItems.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Dots indicator */}
      {mediaItems.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {mediaItems.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex ? "bg-white w-4" : "bg-white/50 hover:bg-white/80"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleDotClick(index);
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CarouselMemory;