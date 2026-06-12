import { motion } from 'framer-motion';

export function GradientBlobs() {
  return (
    <>
      {/* Top right - warm orange/yellow */}
      <motion.div
        className="gradient-blob blob-1"
        animate={{
          x: [0, 20, 0],
          y: [0, -15, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Bottom left - soft blue/purple */}
      <motion.div
        className="gradient-blob blob-2"
        animate={{
          x: [0, -15, 0],
          y: [0, 20, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Right side - soft pink */}
      <motion.div
        className="gradient-blob blob-3"
        animate={{
          x: [0, 15, 0],
          y: [0, 15, 0],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Bottom - soft green */}
      <motion.div
        className="gradient-blob blob-4"
        animate={{
          x: [0, -20, 0],
          y: [0, -10, 0],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </>
  );
}
