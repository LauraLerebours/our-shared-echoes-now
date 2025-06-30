import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface IntroAnimationProps {
  onAnimationComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onAnimationComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions to match window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Colors from the app's theme
    const colors = ['#FFA5BA', '#9b87f5', '#E5DEFF'];
    
    // Animation timing
    const animationDuration = 2000; // 2 seconds
    const startTime = performance.now();
    
    // Logo elements
    const hearts: {
      x: number;
      y: number;
      size: number;
      color: string;
      rotation: number;
      opacity: number;
      targetX: number;
      targetY: number;
      targetSize: number;
      targetRotation: number;
    }[] = [];
    
    // Create scattered hearts that will converge to form the logo
    for (let i = 0; i < 20; i++) {
      hearts.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 30 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        opacity: 0,
        targetX: canvas.width / 2 + (Math.random() - 0.5) * 100,
        targetY: canvas.height / 2 + (Math.random() - 0.5) * 100,
        targetSize: Math.random() * 20 + 10,
        targetRotation: Math.random() * 30 - 15
      });
    }
    
    // Text elements
    const text = "This Is Us";
    let textOpacity = 0;
    
    // Draw heart shape
    function drawHeart(x: number, y: number, size: number, color: string, rotation: number, opacity: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.globalAlpha = opacity;
      
      ctx.beginPath();
      const topCurveHeight = size / 3;
      // Left top curve
      ctx.moveTo(-size / 4, -topCurveHeight);
      ctx.bezierCurveTo(
        -size / 2, -size / 2,
        -size, 0,
        0, size / 2
      );
      // Right top curve
      ctx.bezierCurveTo(
        size, 0,
        size / 2, -size / 2,
        size / 4, -topCurveHeight
      );
      
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
    
    // Animation loop
    function animate(timestamp: number) {
      // Calculate progress (0 to 1)
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(229, 222, 255, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw hearts
      for (const heart of hearts) {
        // Ease in
        const easeProgress = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Update position and size with easing
        heart.x = heart.x + (heart.targetX - heart.x) * easeProgress * 0.1;
        heart.y = heart.y + (heart.targetY - heart.y) * easeProgress * 0.1;
        heart.size = heart.size + (heart.targetSize - heart.size) * easeProgress * 0.1;
        heart.rotation = heart.rotation + (heart.targetRotation - heart.rotation) * easeProgress * 0.1;
        heart.opacity = Math.min(1, progress * 2);
        
        // Draw heart
        drawHeart(heart.x, heart.y, heart.size, heart.color, heart.rotation, heart.opacity);
      }
      
      // Draw text with fade in
      if (progress > 0.5) {
        textOpacity = (progress - 0.5) * 2; // Fade in during second half
        
        ctx.save();
        ctx.globalAlpha = textOpacity;
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Text shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillText(text, canvas.width / 2 + 2, canvas.height / 2 + 2);
        
        // Gradient text
        const textGradient = ctx.createLinearGradient(
          canvas.width / 2 - 100, 
          canvas.height / 2, 
          canvas.width / 2 + 100, 
          canvas.height / 2
        );
        textGradient.addColorStop(0, '#FFA5BA');
        textGradient.addColorStop(1, '#9b87f5');
        
        ctx.fillStyle = textGradient;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }
      
      // Continue animation or end
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete, trigger callback after a short delay
        setTimeout(() => {
          onAnimationComplete();
        }, 500);
      }
    }
    
    // Start animation
    requestAnimationFrame(animate);
    
    // Cleanup not needed as animation will end itself
  }, [onAnimationComplete]);
  
  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
      />
    </motion.div>
  );
};

export default IntroAnimation;