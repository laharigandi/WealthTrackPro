import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const PageTransition = ({ children }) => {
  const shouldReduceMotion = useReducedMotion();
  
  const pageVariants = {
    initial: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 },
    animate: shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
