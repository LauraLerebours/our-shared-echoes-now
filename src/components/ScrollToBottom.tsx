import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToBottomProps {
  containerRef?: React.RefObject<HTMLElement>;
}

const ScrollToBottom: React.FC<ScrollToBottomProps> = ({ containerRef }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const container = containerRef?.current || window;
    const target = containerRef?.current || document.documentElement;

    const checkScrollPosition = () => {
      const scrollTop = containerRef?.current ? containerRef.current.scrollTop : window.pageYOffset;
      const scrollHeight = target.scrollHeight;
      const clientHeight = containerRef?.current ? containerRef.current.clientHeight : window.innerHeight;
      
      // Show button when user has scrolled up from bottom
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const threshold = 200; // Show button when 200px from bottom
      
      setIsNearBottom(distanceFromBottom <= threshold);
      setIsVisible(distanceFromBottom > threshold && scrollTop > 100);
    };

    const handleScroll = () => {
      checkScrollPosition();
    };

    // Initial check
    checkScrollPosition();

    if (containerRef?.current) {
      containerRef.current.addEventListener('scroll', handleScroll);
    } else {
      window.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (containerRef?.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [containerRef]);

  const scrollToBottom = () => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToBottom}
      size="icon"
      className={cn(
        "fixed bottom-20 right-4 z-50 rounded-full shadow-lg",
        "bg-memory-purple hover:bg-memory-purple/90 text-white",
        "transition-all duration-300 ease-in-out",
        "animate-fade-in"
      )}
      title="Scroll to bottom"
    >
      <ChevronDown className="h-5 w-5" />
    </Button>
  );
};

export default ScrollToBottom;