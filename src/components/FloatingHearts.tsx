import React, { useEffect, useRef } from 'react';

interface FloatingHeartsProps {
  count?: number;
}

const FloatingHearts: React.FC<FloatingHeartsProps> = ({ count = 15 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const hearts: HTMLDivElement[] = [];
    const heartColors = ['#FFA5BA', '#9b87f5']; // Pink and Purple colors
    
    // Create hearts
    for (let i = 0; i < count; i++) {
      createHeart();
    }
    
    function createHeart() {
      const heart = document.createElement('div');
      
      // Use colored heart emojis with CSS color filter
      heart.innerHTML = '❤️';
      heart.className = 'absolute opacity-0 text-2xl heart-emoji';
      
      // Apply random color
      const colorIndex = Math.floor(Math.random() * heartColors.length);
      const color = heartColors[colorIndex];
      heart.style.color = color;
      
      // Set random position and animation properties
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.top = `${Math.random() * 100}%`;
      heart.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
      heart.style.animation = `float-up ${Math.random() * 10 + 10}s linear infinite`;
      heart.style.animationDelay = `${Math.random() * 10}s`;
      
      // Apply color filter for emoji
      if (colorIndex === 0) {
        // Pink heart
        heart.style.filter = 'hue-rotate(-10deg) saturate(1.5)';
      } else {
        // Purple heart
        heart.style.filter = 'hue-rotate(230deg) saturate(1.5)';
      }
      
      container.appendChild(heart);
      hearts.push(heart);
    }
    
    // Cleanup
    return () => {
      hearts.forEach(heart => {
        if (container.contains(heart)) {
          container.removeChild(heart);
        }
      });
    };
  }, [count]);
  
  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
    >
      <style jsx>{`
        @keyframes float-up {
          0% {
            transform: translateY(100%) rotate(0deg) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg) scale(1.2);
            opacity: 0;
          }
        }
        
        .heart-emoji {
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
};

export default FloatingHearts;