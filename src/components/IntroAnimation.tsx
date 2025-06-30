import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface IntroAnimationProps {
  onAnimationComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onAnimationComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  
  useEffect(() => {
    // Only run the animation if it hasn't completed yet
    if (animationCompleted) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions to match window
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Colors from the app's theme
    const colors = ['#FFA5BA', '#9b87f5', '#E5DEFF'];
    
    // Animation timing
    const animationDuration = 4000; // 4 seconds total
    const heartFormationTime = 2000; // 2 seconds to form heart
    const heartDisplayTime = 1000; // 1 second to display heart
    const textRiseTime = 1000; // 1 second for text to rise
    const startTime = performance.now();
    
    // Center position
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate responsive font size based on screen dimensions
    const calculateFontSize = () => {
      const baseFontSize = 48;
      const minFontSize = 24;
      const screenSizeMultiplier = Math.min(canvas.width, canvas.height) / 1000;
      return Math.max(minFontSize, Math.floor(baseFontSize * screenSizeMultiplier * 2));
    };
    
    const fontSize = calculateFontSize();
    
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
    let textY = centerY; // Starting Y position for text
    
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
    let animationFrameId: number;
    
    function animate(timestamp: number) {
      // Calculate progress (0 to 1)
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Calculate sub-progress for each animation phase
      const heartFormationProgress = Math.min(elapsed / heartFormationTime, 1);
      const heartDisplayProgress = elapsed > heartFormationTime ? 
        Math.min((elapsed - heartFormationTime) / heartDisplayTime, 1) : 0;
      const textRiseProgress = elapsed > (heartFormationTime + heartDisplayTime) ? 
        Math.min((elapsed - heartFormationTime - heartDisplayTime) / textRiseTime, 1) : 0;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(229, 222, 255, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Calculate heart opacity based on display phase
      // 0 during formation, rises to 1, then falls back to 0
      const heartOpacityMultiplier = heartFormationProgress < 1 ? 1 : 
        (1 - heartDisplayProgress);
      
      // Update and draw hearts
      if (heartOpacityMultiplier > 0) {
        for (const heart of hearts) {
          // Custom easing function for smoother movement
          const easeProgress = heartFormationProgress < 0.5 
            ? 4 * heartFormationProgress * heartFormationProgress * heartFormationProgress 
            : 1 - Math.pow(-2 * heartFormationProgress + 2, 3) / 2;
          
          // Update position and size with easing
          heart.x = heart.x + (heart.targetX - heart.x) * easeProgress * heart.speed;
          heart.y = heart.y + (heart.targetY - heart.y) * easeProgress * heart.speed;
          heart.size = heart.size + (heart.targetSize - heart.size) * easeProgress * 0.1;
          heart.rotation = heart.rotation + (heart.targetRotation - heart.rotation) * easeProgress * 0.1;
          heart.opacity = Math.min(1, heartFormationProgress * 3) * heartOpacityMultiplier; // Fade in faster, then fade out
          
          // Draw heart
          drawHeart(heart.x, heart.y, heart.size, heart.color, heart.rotation, heart.opacity);
        }
      }
      
      // Draw text with fade in and movement
      if (heartFormationProgress > 0.6) {
        // Text appears during heart formation
        textOpacity = Math.min(1, (heartFormationProgress - 0.6) * 2.5);
        
        // Text fades out after heart disappears
        if (textRiseProgress > 0) {
          textOpacity = Math.max(0, 1 - textRiseProgress * 2); // Fade out faster
        }
        
        if (textOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = textOpacity;
          
          // Use responsive font size
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Text shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillText(text, centerX + 2, textY + 2);
          
          // Gradient text
          const textGradient = ctx.createLinearGradient(
            centerX - fontSize * 2, 
            textY, 
            centerX + fontSize * 2, 
            textY
          );
          textGradient.addColorStop(0, '#FFA5BA');
          textGradient.addColorStop(1, '#9b87f5');
          
          ctx.fillStyle = textGradient;
          ctx.fillText(text, centerX, textY);
          ctx.restore();
        }
      }
      
      // Continue animation or end
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Animation complete, trigger callback
        setAnimationCompleted(true);
        onAnimationComplete();
      }
    }
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [onAnimationComplete, animationCompleted]);
  
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