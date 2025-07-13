import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Heart, Users, Camera, Calendar } from 'lucide-react';
import AuthAnimation from '@/components/AuthAnimation';
import FloatingHearts from '@/components/FloatingHearts';
import IntroAnimation from '@/components/IntroAnimation';
import SEOHelmet from '@/components/SEOHelmet';

const Welcome = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [showMainContent, setShowMainContent] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(false);

  // Features to showcase
  const features = [
    {
      title: "Capture Moments Together",
      description: "Save photos, videos, and memories in one beautiful place",
      icon: <Camera className="h-12 w-12 text-memory-pink" />,
      color: "from-memory-pink to-memory-pink/70"
    },
    {
      title: "Share With Your Friends",
      description: "Invite your friends to collaborate on your memory boards",
      icon: <Users className="h-12 w-12 text-memory-purple" />,
      color: "from-memory-purple to-memory-purple/70"
    },
    {
      title: "Build Your Timeline",
      description: "Watch your relationships grow through a beautiful timeline",
      icon: <Calendar className="h-12 w-12 text-memory-pink" />,
      color: "from-memory-pink to-memory-purple"
    }
  ];
  
  // Handle intro animation completion
  const handleIntroComplete = () => {
    setShowMainContent(true);
    setIntroCompleted(true);
  };

  // Auto-advance slides
  useEffect(() => {
    if (!autoplay || !showMainContent) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % features.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoplay, features.length, showMainContent]);

  // Pause autoplay when user interacts
  const handleSlideChange = (index: number) => {
    setAutoplay(false);
    setCurrentSlide(index);
    
    // Resume autoplay after 10 seconds of inactivity
    setTimeout(() => setAutoplay(true), 10000);
  };

  return (
    <>
      <SEOHelmet 
        title="This Is Us - Shared Memories App for Couples & Friends"
        description="Create beautiful memory boards with your loved ones. Share photos, videos, and notes in a private, collaborative space designed for couples and friends."
        canonicalUrl="https://thisisus.space"
      />
      
      <div 
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url('/best2 copy.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Intro Animation */}
        <AnimatePresence>
          {showIntro && !introCompleted && (
            <IntroAnimation onAnimationComplete={handleIntroComplete} />
          )}
        </AnimatePresence>
        
        {/* Existing animated backgrounds - only show after intro */}
        {showMainContent && (
          <>
            <AuthAnimation />
            <FloatingHearts count={15} />
          </>
        )}
        
        {/* Overlay for better readability - only show after intro */}
        {showMainContent && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm"></div>
        )}
        
        <AnimatePresence>
          {showMainContent && (
            <div className="container max-w-4xl mx-auto px-4 py-12 relative z-10">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="inline-block mb-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 260, 
                      damping: 20, 
                      delay: 0.5 
                    }}
                  >
                    <div className="relative">
                      <Heart className="h-16 w-16 text-memory-pink fill-memory-pink" />
                      <Heart 
                        className="h-16 w-16 text-memory-purple fill-memory-purple absolute top-0 left-0 transform -translate-x-6 translate-y-2" 
                        style={{ opacity: 0.8 }}
                      />
                    </div>
                  </motion.div>
                </div>
                
                <motion.h1 
                  className="text-5xl font-bold mb-4 relative"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                >
                  <span className="absolute inset-0 text-black/10 blur-[2px] transform translate-x-[2px] translate-y-[2px]">
                    Amity
                  </span>
                  <span className="relative bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent drop-shadow-md">
                    Amity
                  </span>
                </motion.h1>
                
                <motion.p 
                  className="text-xl text-gray-600 max-w-lg mx-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                >
                  A beautiful space to capture and share memories with the people you love
                </motion.p>
              </motion.div>
              
              {/* Feature Carousel */}
              <div className="mb-12 relative h-64">
                <AnimatePresence mode="wait">
                  {features.map((feature, index) => (
                    currentSlide === index && (
                      <motion.div
                        key={index}
                        className="absolute inset-0 flex flex-col items-center justify-center text-center p-6"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.5 }}
                      >
                        <div className={`p-4 rounded-full bg-gradient-to-br ${feature.color} mb-4 shadow-lg`}>
                          {feature.icon}
                        </div>
                        <h2 className="text-2xl font-bold mb-2">{feature.title}</h2>
                        <p className="text-gray-600">{feature.description}</p>
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>
                
                {/* Slide indicators */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 mt-4">
                  {features.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleSlideChange(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        currentSlide === index 
                          ? 'bg-memory-purple w-6' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
              
              {/* CTA Button */}
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
              >
                <Button
                  onClick={() => navigate('/auth')}
                  className="bg-gradient-to-r from-memory-pink to-memory-purple hover:opacity-90 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg transition-all hover:shadow-xl hover:scale-105"
                >
                  Get Started
                </Button>
                
                <p className="mt-4 text-sm text-gray-500">
                  Create an account or sign in to continue
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default Welcome;