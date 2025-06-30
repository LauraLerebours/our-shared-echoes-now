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
    const animationDuration = 3000; // 3 seconds
    const startTime = performance.now();
    
    // Center position
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Heart shape points (will be the targets for the small hearts)
    const heartPoints: {x: number, y: number}[] = [];
    const heartSize = Math.min(canvas.width, canvas.height) * 0.2; // Responsive heart size
    
    // Generate points along a heart shape
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      // Heart shape parametric equation
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
      
      // Scale and position the heart
      heartPoints.push({
        x: centerX + x * (heartSize / 16),
        y: centerY - y * (heartSize / 16) // Negative because canvas y-axis is flipped
      });
    }
    
    // Logo elements - small hearts that will converge to form the big heart
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
      speed: number;
    }[] = [];
    
    // Create scattered hearts that will converge to form the heart shape
    for (let i = 0; i < 40; i++) {
      // Get a point on the heart shape as the target
      const targetPoint = heartPoints[i % heartPoints.length];
      
      hearts.push({
        // Start from random positions around the screen
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 20 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        opacity: 0,
        // Target is a point on the heart shape
        targetX: targetPoint.x,
        targetY: targetPoint.y,
        targetSize: Math.random() * 10 + 5,
        targetRotation: Math.random() * 30 - 15,
        speed: 0.5 + Math.random() * 0.5 // Random speed for more natural movement
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
        // Custom easing function for smoother movement
        const easeProgress = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Update position and size with easing
        heart.x = heart.x + (heart.targetX - heart.x) * easeProgress * heart.speed;
        heart.y = heart.y + (heart.targetY - heart.y) * easeProgress * heart.speed;
        heart.size = heart.size + (heart.targetSize - heart.size) * easeProgress * 0.1;
        heart.rotation = heart.rotation + (heart.targetRotation - heart.rotation) * easeProgress * 0.1;
        heart.opacity = Math.min(1, progress * 3); // Fade in faster
        
        // Draw heart
        drawHeart(heart.x, heart.y, heart.size, heart.color, heart.rotation, heart.opacity);
      }
      
      // Draw text with fade in
      if (progress > 0.6) {
        textOpacity = (progress - 0.6) * 2.5; // Fade in during last part
        
        ctx.save();
        ctx.globalAlpha = textOpacity;
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Text shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillText(text, centerX + 2, centerY + 2);
        
        // Gradient text
        const textGradient = ctx.createLinearGradient(
          centerX - 100, 
          centerY, 
          centerX + 100, 
          centerY
        );
        textGradient.addColorStop(0, '#FFA5BA');
        textGradient.addColorStop(1, '#9b87f5');
        
        ctx.fillStyle = textGradient;
        ctx.fillText(text, centerX, centerY);
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