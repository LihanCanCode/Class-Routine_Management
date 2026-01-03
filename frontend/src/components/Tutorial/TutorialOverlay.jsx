import { useEffect, useState } from 'react';

export default function TutorialOverlay({ targetSelector, show, children, onBackdropClick, blockClicks = false }) {
    const [targetRect, setTargetRect] = useState(null);
    const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!show || !targetSelector) {
            setTargetRect(null);
            return;
        }

        const updateTargetPosition = () => {
            const target = document.querySelector(targetSelector);
            if (target) {
                const rect = target.getBoundingClientRect();
                setTargetRect(rect);
            } else {
                setTargetRect(null);
            }
            setViewportDimensions({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        updateTargetPosition();
        window.addEventListener('resize', updateTargetPosition);
        window.addEventListener('scroll', updateTargetPosition, true);

        return () => {
            window.removeEventListener('resize', updateTargetPosition);
            window.removeEventListener('scroll', updateTargetPosition, true);
        };
    }, [show, targetSelector]);

    if (!show) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && onBackdropClick) {
            onBackdropClick();
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[9999] pointer-events-none"
            style={{ isolation: 'isolate' }}
        >
            {/* Spotlight effect using SVG mask */}
            {targetRect ? (
                <svg 
                    className="absolute inset-0 w-full h-full pointer-events-none"
                >
                    <defs>
                        <mask id="spotlight-mask">
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            <rect
                                x={targetRect.left - 8}
                                y={targetRect.top - 8}
                                width={targetRect.width + 16}
                                height={targetRect.height + 16}
                                rx="12"
                                fill="black"
                            />
                        </mask>
                    </defs>
                    <rect 
                        x="0" 
                        y="0" 
                        width="100%" 
                        height="100%" 
                        fill="rgba(0, 0, 0, 0.7)" 
                        mask="url(#spotlight-mask)"
                    />
                </svg>
            ) : (
                // Full overlay when no target
                <div 
                    className="absolute inset-0 bg-black/70 pointer-events-none"
                />
            )}

            {/* Highlight border with pulse animation */}
            {targetRect && (
                <>
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: `${targetRect.left - 8}px`,
                            top: `${targetRect.top - 8}px`,
                            width: `${targetRect.width + 16}px`,
                            height: `${targetRect.height + 16}px`,
                            border: '4px solid rgb(59, 130, 246)',
                            borderRadius: '12px',
                            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px 8px rgba(59, 130, 246, 0.5)',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            zIndex: 10001
                        }}
                    />
                    {/* Invisible blocking layer for specific steps */}
                    {blockClicks && (
                        <div
                            className="absolute pointer-events-auto cursor-not-allowed"
                            style={{
                                left: `${targetRect.left - 8}px`,
                                top: `${targetRect.top - 8}px`,
                                width: `${targetRect.width + 16}px`,
                                height: `${targetRect.height + 16}px`,
                                zIndex: 10000,
                                background: 'transparent'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </>
            )}

            {/* Content layer */}
            <div className="absolute inset-0 pointer-events-none">
                {children}
            </div>
        </div>
    );
}
