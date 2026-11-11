import React, { useRef } from 'react';
import { motion, useDragControls, useReducedMotion } from 'motion/react';

interface PropertyDetailSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}

export function PropertyDetailSheet({ children, onClose, className = '' }: PropertyDetailSheetProps) {
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const didDrag = useRef(false);

  return (
    <div className={`${className} absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end`}>
      <motion.div
        className="w-full min-h-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col max-h-full overflow-hidden"
        initial={{ y: reduceMotion ? 0 : '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        dragMomentum={false}
        onDragStart={() => { didDrag.current = true; }}
        onDragEnd={(_, { offset, velocity }) => {
          if (offset.y > 100 || (offset.y > 20 && velocity.y > 500)) onClose();
        }}
      >
        <button
          type="button"
          aria-label="Close details"
          title="Swipe down or tap to close details"
          className="flex min-h-11 w-full shrink-0 touch-none select-none items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-600"
          onPointerDown={event => {
            didDrag.current = false;
            dragControls.start(event);
          }}
          onClick={event => {
            // A pointer click can follow a short drag that should snap back.
            if (!didDrag.current || event.detail === 0) onClose();
          }}
        >
          <span aria-hidden="true" className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </button>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </motion.div>
    </div>
  );
}
