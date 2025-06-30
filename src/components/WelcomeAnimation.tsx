import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const WelcomeAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
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
    
    // Particle class for floating elements
    class Particle {
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      opacity: number;
      shape: string;
      rotation: number;
      rotationSpeed: number;
      
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 20 + 10;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speedX = (Math.random() - 0.5) * 1.5;
        this.speedY = (Math.random() - 0.5) * 1.5;
        this.opacity = Math.random() * 0.5 + 0.2;
        // Random shape: circle, square, triangle, heart
        const shapes = ['circle', 'square', 'triangle', 'heart'];
        this.shape = shapes[Math.floor(Math.random() * shapes.length)];
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 2;
      }
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        
        // Bounce off edges
        if (this.x > canvas.width || this.x < 0) {
          this.speedX = -this.speedX;
        }
        
        if (this.y > canvas.height || this.y < 0) {
          this.speedY = -this.speedY;
        }
      }
      
      draw() {
        if (!ctx) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        
        switch (this.shape) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
            
          case 'square':
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
            break;
            
          case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -this.size / 2);
            ctx.lineTo(-this.size / 2, this.size / 2);
            ctx.lineTo(this.size / 2, this.size / 2);
            ctx.closePath();
            ctx.fill();
            break;
            
          case 'heart':
            ctx.beginPath();
            const topCurveHeight = this.size / 3;
            // Left top curve
            ctx.moveTo(-this.size / 4, -topCurveHeight);
            ctx.bezierCurveTo(
              -this.size / 2, -this.size / 2,
              -this.size, 0,
              0, this.size / 2
            );
            // Right top curve
            ctx.bezierCurveTo(
              this.size, 0,
              this.size / 2, -this.size / 2,
              this.size / 4, -topCurveHeight
            );
            ctx.fill();
            break;
        }
        
        ctx.restore();
      }
    }
    
    // Create particles
    const particleCount = Math.min(30, Math.floor((canvas.width * canvas.height) / 30000));
    const particles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
    
    // Light trails effect
    class LightTrail {
      points: {x: number, y: number}[];
      maxPoints: number;
      color: string;
      width: number;
      
      constructor() {
        this.points = [];
        this.maxPoints = Math.floor(Math.random() * 15) + 5;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.width = Math.random() * 3 + 1;
        
        // Initialize with random points
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;
        
        for (let i = 0; i < this.maxPoints; i++) {
          this.points.push({
            x: startX + (Math.random() - 0.5) * 100,
            y: startY + (Math.random() - 0.5) * 100
          });
        }
      }
      
      update() {
        // Move the first point randomly
        if (this.points.length > 0) {
          const firstPoint = this.points[0];
          firstPoint.x += (Math.random() - 0.5) * 4;
          firstPoint.y += (Math.random() - 0.5) * 4;
          
          // Keep within canvas
          firstPoint.x = Math.max(0, Math.min(canvas.width, firstPoint.x));
          firstPoint.y = Math.max(0, Math.min(canvas.height, firstPoint.y));
          
          // Move other points towards the first point
          for (let i = 1; i < this.points.length; i++) {
            const point = this.points[i];
            const prevPoint = this.points[i - 1];
            
            point.x += (prevPoint.x - point.x) * 0.1;
            point.y += (prevPoint.y - point.y) * 0.1;
          }
        }
      }
      
      draw() {
        if (!ctx || this.points.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 1; i < this.points.length; i++) {
          const point = this.points[i];
          const prevPoint = this.points[i - 1];
          
          // Create a smooth curve
          const xc = (point.x + prevPoint.x) / 2;
          const yc = (point.y + prevPoint.y) / 2;
          
          ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc);
        }
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.5;
        ctx.stroke();
      }
    }
    
    // Create light trails
    const trailCount = 8;
    const trails: LightTrail[] = [];
    
    for (let i = 0; i < trailCount; i++) {
      trails.push(new LightTrail());
    }
    
    // Animation loop
    let animationFrameId: number;
    
    function animate() {
      if (!ctx) return;
      
      // Clear canvas with a slight fade effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      for (const particle of particles) {
        particle.update();
        particle.draw();
      }
      
      // Update and draw light trails
      for (const trail of trails) {
        trail.update();
        trail.draw();
      }
      
      // Add subtle gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 165, 186, 0.03)');
      gradient.addColorStop(1, 'rgba(155, 135, 245, 0.03)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      animationFrameId = requestAnimationFrame(animate);
    }
    
    animate();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 -z-10"
      style={{ 
        background: 'transparent',
        pointerEvents: 'none'
      }}
    />
  );
};

export default WelcomeAnimation;