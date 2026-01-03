import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTutorial } from '../../context/TutorialContext';
import TutorialOverlay from './TutorialOverlay';
import TutorialCard from './TutorialCard';
import { tutorialSteps } from './tutorialSteps';

export default function TutorialManager() {
    const { 
        showTutorial, 
        currentStep, 
        nextStep, 
        previousStep, 
        skipTutorial, 
        completeTutorial 
    } = useTutorial();
    
    const location = useLocation();
    const navigate = useNavigate();

    const currentStepData = tutorialSteps[currentStep];

    // Add click listener to auto-advance when clicking highlighted element
    useEffect(() => {
        if (!showTutorial || !currentStepData?.targetElement) return;

        const handleTargetClick = (e) => {
            const target = document.querySelector(currentStepData.targetElement);
            if (!target) return;
            
            // Check if the clicked element is within the target or is the target itself
            if (target.contains(e.target) || target === e.target) {
                // Auto-advance for interactive steps (excluding step 2 which blocks clicks)
                const autoAdvanceSteps = [1, 3, 6, 7, 8, 9]; // Steps where clicking should auto-advance
                
                if (autoAdvanceSteps.includes(currentStep)) {
                    // For navigation steps (1, 3, 6), handle navigation first
                    if (currentStep === 1) {
                        navigate('/upload');
                        setTimeout(() => nextStep(), 100);
                    } else if (currentStep === 3) {
                        navigate('/view');
                        setTimeout(() => nextStep(), 100);
                    } else if (currentStep === 6) {
                        navigate('/book');
                        setTimeout(() => nextStep(), 100);
                    } else {
                        // For other steps, just advance
                        setTimeout(() => nextStep(), 300);
                    }
                }
            }
        };

        // Add listener to document to catch all clicks
        document.addEventListener('click', handleTargetClick, true);
        
        return () => {
            document.removeEventListener('click', handleTargetClick, true);
        };
    }, [showTutorial, currentStepData, currentStep, nextStep, navigate]);

    useEffect(() => {
        // Check if we should skip this step based on route
        if (currentStepData?.showWhen && showTutorial) {
            const requiredRoute = currentStepData.showWhen.replace('route:', '');
            if (!location.pathname.includes(requiredRoute)) {
                // If skipIfNotFound, move to next step
                if (currentStepData.skipIfNotFound) {
                    // Auto-advance after a short delay
                    const timer = setTimeout(() => {
                        if (currentStep < tutorialSteps.length - 1) {
                            nextStep();
                        }
                    }, 500);
                    return () => clearTimeout(timer);
                }
            }
        }
    }, [currentStep, location.pathname, showTutorial, currentStepData, nextStep]);

    const handleNext = () => {
        // Handle navigation-based steps only when using Next button
        if (currentStep === 1 && !location.pathname.includes('/upload')) {
            navigate('/upload');
            nextStep();
        } else if (currentStep === 3 && !location.pathname.includes('/view')) {
            navigate('/view');
            nextStep();
        } else if (currentStep === 6 && !location.pathname.includes('/book')) {
            navigate('/book');
            nextStep();
        } else if (currentStep === 10) {
            // Navigate to quiz booking page
            navigate('/quiz');
            nextStep();
        } else if (currentStep === 11) {
            // Navigate to quiz schedule page
            navigate('/view-quiz');
            nextStep();
        } else if (currentStep === tutorialSteps.length - 1) {
            completeTutorial();
        } else {
            nextStep();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            previousStep();
        }
    };

    if (!showTutorial || !currentStepData) {
        return null;
    }

    // Enhance description for booking step with demo data
    let description = currentStepData.description;
    if (currentStepData.demoData) {
        const nextMonday = new Date();
        nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
        const dateStr = nextMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        description = `Select room: ${currentStepData.demoData.room}, Date: Next Monday (${dateStr}), Time: ${currentStepData.demoData.time}. This slot is free and perfect for demo booking!`;
    }
    
    // Add helpful hints for booking steps
    if (currentStep === 7) {
        const nextMonday = new Date();
        nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
        const dateStr = nextMonday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        description = `Select ${dateStr} from the calendar to see available rooms for that day.`;
    } else if (currentStep === 8) {
        description = "Click on the 11:30-13:00 time slot to check room availability during this period.";
    } else if (currentStep === 9) {
        description = "Perfect! DEMO-101 should be available. Click on it to open the booking modal, fill in your event details, and confirm the booking!";
    }

    return (
        <>
            <TutorialOverlay
                targetSelector={currentStepData.targetElement}
                show={showTutorial}
                onBackdropClick={null} // Prevent closing on backdrop click
                blockClicks={currentStep === 2} // Block clicks on upload area (step 2)
            >
                <TutorialCard
                    step={currentStep}
                    totalSteps={tutorialSteps.length}
                    title={currentStepData.title}
                    description={description}
                    position={currentStepData.position}
                    targetSelector={currentStepData.targetElement}
                    actions={currentStepData.actions}
                    onNext={handleNext}
                    onPrevious={currentStep > 0 ? handlePrevious : null}
                    onSkip={skipTutorial}
                />
            </TutorialOverlay>
        </>
    );
}
