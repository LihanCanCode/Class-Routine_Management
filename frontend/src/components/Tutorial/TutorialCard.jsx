import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function TutorialCard({ 
    step, 
    totalSteps, 
    title, 
    description, 
    position = 'center',
    targetSelector,
    actions,
    onNext, 
    onPrevious, 
    onSkip 
}) {
    const [cardPosition, setCardPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

    useEffect(() => {
        if (position === 'center' || !targetSelector) {
            setCardPosition({ 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)' 
            });
            return;
        }

        const calculatePosition = () => {
            const target = document.querySelector(targetSelector);
            if (!target) {
                setCardPosition({ 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)' 
                });
                return;
            }

            const rect = target.getBoundingClientRect();
            const cardWidth = 400;
            const cardHeight = 250;
            const spacing = 24;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top, left, transform;

            switch (position) {
                case 'bottom':
                    top = Math.min(rect.bottom + spacing, viewportHeight - cardHeight - 20);
                    left = rect.left + rect.width / 2;
                    transform = 'translateX(-50%)';
                    break;
                case 'top':
                    top = Math.max(rect.top - cardHeight - spacing, 20);
                    left = rect.left + rect.width / 2;
                    transform = 'translateX(-50%)';
                    break;
                case 'left':
                    top = rect.top + rect.height / 2;
                    left = Math.max(rect.left - cardWidth - spacing, 20);
                    transform = 'translateY(-50%)';
                    break;
                case 'right':
                    top = rect.top + rect.height / 2;
                    left = Math.min(rect.right + spacing, viewportWidth - cardWidth - 20);
                    transform = 'translateY(-50%)';
                    break;
                case 'bottom-right':
                    top = Math.min(rect.bottom + spacing, viewportHeight - cardHeight - 20);
                    left = Math.min(rect.right, viewportWidth - 20);
                    transform = 'translateX(-100%)';
                    break;
                case 'bottom-left':
                    top = Math.min(rect.bottom + spacing, viewportHeight - cardHeight - 20);
                    left = Math.max(rect.left, 20);
                    transform = 'none';
                    break;
                default:
                    setCardPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
                    return;
            }

            // Additional boundary checks for vertical centering positions
            if (transform.includes('translateY')) {
                // For left/right positions, ensure vertically centered card stays in viewport
                if (top - cardHeight / 2 < 20) {
                    top = 20;
                    transform = 'none';
                } else if (top + cardHeight / 2 > viewportHeight - 20) {
                    top = viewportHeight - cardHeight - 20;
                    transform = 'none';
                } else {
                    top = top; // Keep as is for translateY(-50%)
                }
            }

            // Additional boundary checks for horizontal centering positions
            if (transform.includes('translateX(-50%)')) {
                // For top/bottom positions, ensure horizontally centered card stays in viewport
                if (left - cardWidth / 2 < 20) {
                    left = 20;
                    transform = transform.replace('translateX(-50%)', '');
                } else if (left + cardWidth / 2 > viewportWidth - 20) {
                    left = viewportWidth - cardWidth - 20;
                    transform = transform.replace('translateX(-50%)', '');
                }
            }

            setCardPosition({ 
                top: typeof top === 'number' ? `${top}px` : top, 
                left: typeof left === 'number' ? `${left}px` : left, 
                transform 
            });
        };

        calculatePosition();
        window.addEventListener('resize', calculatePosition);
        window.addEventListener('scroll', calculatePosition, true);

        return () => {
            window.removeEventListener('resize', calculatePosition);
            window.removeEventListener('scroll', calculatePosition, true);
        };
    }, [position, targetSelector]);

    return (
        <div 
            className="fixed bg-white rounded-2xl shadow-2xl pointer-events-auto max-w-md w-full"
            style={{
                ...cardPosition,
                zIndex: 10000,
                animation: 'slideIn 0.3s ease-out'
            }}
        >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        {Array.from({ length: totalSteps }).map((_, idx) => (
                            <div 
                                key={idx}
                                className={`h-2 rounded-full transition-all ${
                                    idx === step 
                                        ? 'w-8 bg-blue-600' 
                                        : idx < step 
                                        ? 'w-2 bg-blue-400' 
                                        : 'w-2 bg-gray-300'
                                }`}
                            />
                        ))}
                    </div>
                </div>
                <button 
                    onClick={onSkip}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Skip tutorial"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="p-6">
                <p className="text-gray-700 leading-relaxed">{description}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 bg-gray-50 rounded-b-2xl">
                <div className="text-sm text-gray-500">
                    Step {step + 1} of {totalSteps}
                </div>
                <div className="flex gap-3">
                    {onPrevious && step > 0 && (
                        <button
                            onClick={onPrevious}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                            {actions?.previous || 'Previous'}
                        </button>
                    )}
                    <button
                        onClick={onNext}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                    >
                        {actions?.next || (step === totalSteps - 1 ? 'Finish' : 'Next')}
                    </button>
                </div>
            </div>
        </div>
    );
}
