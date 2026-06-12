import { motion } from 'framer-motion';
import { Mic, ArrowRight } from 'lucide-react';

export function SetupView() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        className="max-w-md w-full text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Icon */}
        <motion.div
          className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #FFB347, #FF9F1C)',
            boxShadow: '0 10px 30px rgba(255, 159, 28, 0.3)',
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Mic className="w-10 h-10 text-white" />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-3xl font-bold text-gray-800 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Welcome to KidBot!
        </motion.h1>

        {/* Description */}
        <motion.p
          className="text-gray-600 mb-8 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Before we start our adventure together, we need to register your voice. 
          This helps me recognize you and keep our conversations safe!
        </motion.p>

        {/* Setup card */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="font-semibold text-gray-800 mb-4">Voice Registration</h2>
          <ol className="text-left text-sm text-gray-600 space-y-3">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                1
              </span>
              <span>Click the microphone button below</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                2
              </span>
              <span>Say "Hello, I'm ready to be your friend"</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                3
              </span>
              <span>Wait for confirmation</span>
            </li>
          </ol>
        </motion.div>

        {/* Start button */}
        <motion.button
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg"
          style={{
            background: 'linear-gradient(135deg, #FFB347, #FF9F1C)',
            boxShadow: '0 8px 25px rgba(255, 159, 28, 0.4)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          Start Setup
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </motion.div>
    </div>
  );
}
