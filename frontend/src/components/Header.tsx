import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left side - Logo and status */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* V Logo */}
        <motion.div
          className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-xl sm:text-2xl"
          style={{
            background: 'linear-gradient(135deg, #FF9F1C 0%, #FFB347 100%)',
            boxShadow: '0 4px 15px rgba(255, 159, 28, 0.3)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          V
        </motion.div>

        {/* Green status pill - Hidden on very small screens */}
        <motion.div
          className="hidden xs:flex w-10 h-7 sm:w-12 sm:h-8 bg-white rounded-full items-center justify-center shadow-sm"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.8, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
            }}
          />
        </motion.div>
      </div>

      {/* Right side - Friendship status and avatar */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Friendship status badge - Simplified on mobile */}
        <motion.div
          className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-sm rounded-full px-2 sm:px-4 py-1.5 sm:py-2 shadow-sm"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Lock icon - Hidden on mobile */}
          <div className="hidden sm:flex w-8 h-8 bg-teal-100 rounded-lg items-center justify-center">
            <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          {/* Text and signal */}
          <div className="flex flex-col">
            <span className="hidden sm:block text-[10px] font-semibold text-rose-400 tracking-wider uppercase">
              FRIENDSHIP STATUS
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-bold text-teal-600">Connected</span>
              {/* Signal bars */}
              <div className="flex items-end gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 sm:w-1 bg-emerald-500 rounded-full"
                    style={{ height: `${i * 2 + 3}px` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* User avatar */}
        <motion.div
          className="w-9 h-9 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 sm:w-7 sm:h-7 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
