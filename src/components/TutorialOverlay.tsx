import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Heart, Users, Camera, Share2, ArrowRight, FileText, Images, Calendar, Globe, Lock, Plus, Grid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const TutorialOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const { user } = useAuth();

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Welcome to This Is Us!",
      description: "A beautiful space to capture and share memories with your loved ones. Let's walk through the main features together.",
      icon: <Heart className="h-12 w-12" />,
      color: "bg-memory-pink text-white"
    },
    {
      title: "Create Memory Boards",
      description: "Boards help you organize memories by theme, event, or relationship. Create private boards for close friends or public boards anyone can join.",
      icon: <Grid className="h-12 w-12" />,
      color: "bg-memory-purple text-white"
    },
    {
      title: "Add Different Memory Types",
      description: "Capture photos, videos, text notes, or create carousels with multiple images and videos in a single memory.",
      icon: <Camera className="h-12 w-12" />,
      color: "bg-memory-pink text-white"
    },
    {
      title: "Invite Friends & Family",
      description: "Share your board code with friends and family so they can join and contribute memories. Everyone can add photos, like, and comment.",
      icon: <Users className="h-12 w-12" />,
      color: "bg-memory-purple text-white"
    },
    {
      title: "View Timeline or Grid",
      description: "Switch between timeline view for detailed memories or grid view for a visual overview of all your memories.",
      icon: <List className="h-12 w-12" />,
      color: "bg-memory-pink text-white"
    },
    {
      title: "Save Drafts",
      description: "Working on a memory but not ready to post? Save it as a draft and come back to it later. Your drafts sync across devices.",
      icon: <FileText className="h-12 w-12" />,
      color: "bg-memory-purple text-white"
    },
    {
      title: "Create Public Boards",
      description: "Make your boards public so anyone can discover and join them, or keep them private for just the people you invite.",
      icon: <Globe className="h-12 w-12" />,
      color: "bg-memory-pink text-white"
    }
  ];

  useEffect(() => {
    // Check if tutorial has been seen before
    const tutorialSeen = localStorage.getItem('tutorialSeen');
    
    // Only show tutorial for new users who haven't seen it
    if (user && !tutorialSeen) {
      // Delay showing the tutorial to ensure the app has loaded
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    
    // After animation completes, hide the tutorial
    setTimeout(() => {
      setIsVisible(false);
      // Mark tutorial as seen in localStorage
      localStorage.setItem('tutorialSeen', 'true');
    }, 300);
  };

  // Function to show tutorial again (can be triggered from settings)
  const showTutorial = () => {
    setCurrentStep(0);
    setDismissed(false);
    setIsVisible(true);
  };

  // Expose the showTutorial function to window for external access
  useEffect(() => {
    (window as any).showAppTutorial = showTutorial;
    return () => {
      delete (window as any).showAppTutorial;
    };
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Close button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 z-10" 
              onClick={handleDismiss}
            >
              <X className="h-5 w-5" />
            </Button>
            
            {/* Progress indicator */}
            <div className="flex justify-center gap-1 absolute top-4 left-0 right-0">
              {tutorialSteps.map((_, index) => (
                <div 
                  key={index} 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === currentStep ? 'w-6 bg-memory-purple' : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>
            
            {/* Content */}
            <div className="pt-10 pb-6 px-6">
              <div className={`w-20 h-20 rounded-full ${tutorialSteps[currentStep].color} flex items-center justify-center mx-auto mb-6`}>
                {tutorialSteps[currentStep].icon}
              </div>
              
              <h2 className="text-2xl font-bold text-center mb-3">
                {tutorialSteps[currentStep].title}
              </h2>
              
              <p className="text-center text-gray-600 mb-4">
                {tutorialSteps[currentStep].description}
              </p>
              
              <div className="flex justify-between items-center">
                {currentStep > 0 ? (
                  <Button 
                    variant="outline"
                    onClick={handlePrevious}
                  >
                    Previous
                  </Button>
                ) : (
                  <div></div> // Empty div to maintain layout
                )}
                
                <Button 
                  onClick={handleNext}
                  className="bg-memory-purple hover:bg-memory-purple/90 px-6"
                >
                  {currentStep < tutorialSteps.length - 1 ? (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    'Get Started'
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TutorialOverlay;