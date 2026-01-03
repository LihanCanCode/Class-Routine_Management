import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { skipTutorial as apiSkipTutorial, completeTutorial as apiCompleteTutorial } from '../services/api';

const TutorialContext = createContext();

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within TutorialProvider');
    }
    return context;
};

export const TutorialProvider = ({ children }) => {
    const { user } = useAuth();
    const [showTutorial, setShowTutorial] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([]);
    const [tutorialCompleted, setTutorialCompleted] = useState(localStorage.getItem('tutorialCompleted') === 'true');
    const [tutorialSkipped, setTutorialSkipped] = useState(localStorage.getItem('tutorialSkipped') === 'true');

    useEffect(() => {
        // Show tutorial for all admin logins (for testing/demo)
        if (user && user.role === 'admin') {
            // Always show tutorial on login
            setShowTutorial(true);
            setCurrentStep(0);
        }
    }, [user]);

    const startTutorial = () => {
        setShowTutorial(true);
        setCurrentStep(0);
        setCompletedSteps([]);
    };

    const nextStep = () => {
        setCompletedSteps(prev => [...new Set([...prev, currentStep])]);
        setCurrentStep(prev => prev + 1);
    };

    const previousStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const skipTutorial = async () => {
        setShowTutorial(false);
        setTutorialSkipped(true);
        localStorage.setItem('tutorialSkipped', 'true');
        
        // Save to backend
        try {
            await apiSkipTutorial();
        } catch (error) {
            console.error('Failed to save tutorial skip:', error);
        }
    };

    const completeTutorial = async () => {
        setShowTutorial(false);
        setTutorialCompleted(true);
        localStorage.setItem('tutorialCompleted', 'true');
        
        try {
            await apiCompleteTutorial();
            localStorage.removeItem('tutorialSkipped');
        } catch (error) {
            console.error('Failed to save tutorial completion:', error);
        }
    };

    const goToStep = (stepNumber) => {
        setCurrentStep(stepNumber);
    };

    const value = {
        showTutorial,
        currentStep,
        completedSteps,
        tutorialCompleted,
        tutorialSkipped,
        hideDemoRoom: tutorialCompleted || tutorialSkipped, // Hide DEMO-101 if tutorial completed or skipped
        startTutorial,
        nextStep,
        previousStep,
        skipTutorial,
        completeTutorial,
        goToStep
    };

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
};
