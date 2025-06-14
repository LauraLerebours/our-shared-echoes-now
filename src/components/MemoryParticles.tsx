import React, { useEffect, useRef } from 'react';

const MemoryParticles: React.FC = () => {
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
    
    // Create image objects for memory particles
    const images: HTMLImageElement[] = [];
    const imageCount = 8;
    
    // Create polaroid-style frames
    for (let i = 0; i < imageCount; i++) {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
        <svg width="60" height="70" viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="60" height="70" rx="3" fill="white" stroke="#E5E7EB" stroke-width="1"/>
          <rect x="5" y="5" width="50" height="40" rx="1" fill="${['#FFA5BA', '#9b87f5', '#E5DEFF'][i % 3]}" opacity="0.6"/>
          <rect x="5" y="50" width="50" height="3" rx="1" fill="#9b87f5" opacity="0.3"/>
          <rect x="5" y="56" width="30" height="2" rx="1" fill="#9b87f5" opacity="0.3"/>
        </svg>
      `)}`;
      images.push(img);
    }
    
    // Particle class
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      image: HTMLImageElement;
      opacity: number;
      
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 30 + 20;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 0.5 - 0.25;
        this.image = images[Math.floor(Math.random() * images.length)];
        this.opacity = Math.random() * 0.3 + 0.1;
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
        ctx.drawImage(this.image, -this.size/2, -this.size/2, this.size, this.size * 1.2);
        ctx.restore();
      }
    }
    
    // Create particles
    const particleCount = Math.min(15, Math.floor((canvas.width * canvas.height) / 40000));
    const particles: Particle[] = [];
    
    // Wait for images to load
    const loadImages = () => {
      let loadedCount = 0;
      images.forEach(img => {
        img.onload = () => {
          loadedCount++;
          if (loadedCount === images.length) {
            // All images loaded, create particles
            for (let i = 0; i < particleCount; i++) {
              particles.push(new Particle());
            }
            animate();
          }
        };
      });
    };
    
    loadImages();
    
    // Animation loop
    let animationFrameId: number;
    
    function animate() {
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      for (const particle of particles) {
        particle.update();
        particle.draw();
      }
      
      // Add subtle gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 165, 186, 0.03)');
      gradient.addColorStop(1, 'rgba(155, 135, 245, 0.03)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      animationFrameId = requestAnimationFrame(animate);
    }
    
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

export default MemoryParticles;