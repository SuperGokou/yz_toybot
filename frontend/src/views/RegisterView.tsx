import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Baby, 
  Calendar, 
  Bell, 
  Clock, 
  Heart,
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Send
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import type { ParentProfile } from '../types';

const INTERESTS = [
  { id: 'animals', label: 'Animals' },
  { id: 'space', label: 'Space' },
  { id: 'dinosaurs', label: 'Dinosaurs' },
  { id: 'music', label: 'Music' },
  { id: 'art', label: 'Art' },
  { id: 'sports', label: 'Sports' },
  { id: 'nature', label: 'Nature' },
  { id: 'stories', label: 'Stories' },
  { id: 'science', label: 'Science' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'building', label: 'Building' },
  { id: 'puzzles', label: 'Puzzles' },
];

const STEPS = [
  { id: 1, title: 'Parent', icon: User },
  { id: 2, title: 'Child', icon: Baby },
  { id: 3, title: 'Interests', icon: Heart },
  { id: 4, title: 'Reports', icon: Bell },
];

export function RegisterView() {
  const { setCurrentView, setStatus, status } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ParentProfile>({
    parentName: '',
    parentEmail: '',
    childName: '',
    childAge: 4,
    childInterests: [],
    dailyReportEnabled: true,
    reportTime: '18:00',
  });

  const updateField = <K extends keyof ParentProfile>(
    field: K,
    value: ParentProfile[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      childInterests: prev.childInterests?.includes(interest)
        ? prev.childInterests.filter((i) => i !== interest)
        : [...(prev.childInterests || []), interest],
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.parentName.trim()) {
          setError('Please enter your name');
          return false;
        }
        if (!formData.parentEmail.trim() || !formData.parentEmail.includes('@')) {
          setError('Please enter a valid email address');
          return false;
        }
        return true;
      case 2:
        if (!formData.childName.trim()) {
          setError("Please enter your child's name");
          return false;
        }
        if (formData.childAge < 2 || formData.childAge > 12) {
          setError('Age should be between 2 and 12');
          return false;
        }
        return true;
      case 3:
        return true; // Interests are optional
      case 4:
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.registerParent(formData);
      setSubmitSuccess(true);
      
      // Update status to show parent is registered
      setStatus({
        ...status,
        parentRegistered: true,
      });

      // Redirect to chat after delay
      setTimeout(() => {
        setCurrentView('chat');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, setCurrentView, setStatus, status]);

  // Success screen
  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <motion.div
          className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          <motion.div
            className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Check className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
          </motion.div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
            Welcome to VV's Family!
          </h2>
          
          <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
            Hi <strong>{formData.parentName}</strong>! You're all set.
          </p>
          
          <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
            {formData.dailyReportEnabled ? (
              <>
                Daily reports for <strong>{formData.childName}</strong> will be sent to{' '}
                <strong className="break-all">{formData.parentEmail}</strong> at {formData.reportTime}.
              </>
            ) : (
              <>
                You can enable daily reports anytime in settings.
              </>
            )}
          </p>

          <motion.div
            className="flex items-center justify-center gap-2 text-orange-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium text-sm sm:text-base">Redirecting to VV...</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 pb-20 md:pb-6">
      <motion.div
        className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-lg w-full shadow-xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="text-center mb-4 sm:mb-8">
          <motion.div
            className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <span className="text-2xl sm:text-3xl font-bold text-white">V</span>
          </motion.div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Join VV's Family</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Set up your child's learning companion</p>
        </div>

        {/* Progress Steps - Compact on mobile */}
        <div className="flex justify-between mb-6 sm:mb-8 px-0 sm:px-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <motion.div
                  className={`
                    w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isActive ? 'bg-orange-500 text-white shadow-lg' : ''}
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400' : ''}
                  `}
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                </motion.div>
                <span className={`text-[10px] sm:text-xs mt-1 ${isActive ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="min-h-[220px] sm:min-h-[280px]"
          >
            {/* Step 1: Parent Info */}
            {currentStep === 1 && (
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.parentName}
                      onChange={(e) => updateField('parentName', e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:outline-none transition-colors text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.parentEmail}
                      onChange={(e) => updateField('parentEmail', e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:outline-none transition-colors text-sm sm:text-base"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send daily learning reports here
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Child Info */}
            {currentStep === 2 && (
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Child's Name
                  </label>
                  <div className="relative">
                    <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.childName}
                      onChange={(e) => updateField('childName', e.target.value)}
                      placeholder="Enter child's name"
                      className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:outline-none transition-colors text-sm sm:text-base"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    VV will use this name to personalize conversations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Child's Age
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <select
                      value={formData.childAge}
                      onChange={(e) => updateField('childAge', parseInt(e.target.value))}
                      className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:outline-none transition-colors appearance-none bg-white text-sm sm:text-base"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                        <option key={age} value={age}>
                          {age} years old
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Interests */}
            {currentStep === 3 && (
              <div>
                <p className="text-sm text-gray-600 mb-3 sm:mb-4">
                  What does {formData.childName || 'your child'} enjoy?
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                  {INTERESTS.map((interest) => {
                    const isSelected = formData.childInterests?.includes(interest.id);
                    return (
                      <motion.button
                        key={interest.id}
                        type="button"
                        onClick={() => toggleInterest(interest.id)}
                        className={`
                          p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 text-center transition-all
                          ${isSelected 
                            ? 'border-orange-400 bg-orange-50 text-orange-700' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }
                        `}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="text-[10px] sm:text-xs font-medium">{interest.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Report Settings */}
            {currentStep === 4 && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-orange-50 rounded-xl p-3 sm:p-4 border border-orange-100">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800 text-sm sm:text-base">Daily Learning Reports</h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        Get summaries of {formData.childName || "your child"}'s learning activities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                    <span className="font-medium text-gray-700 text-sm sm:text-base">Enable Reports</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('dailyReportEnabled', !formData.dailyReportEnabled)}
                    className={`
                      w-11 h-6 rounded-full transition-colors relative
                      ${formData.dailyReportEnabled ? 'bg-orange-500' : 'bg-gray-300'}
                    `}
                  >
                    <motion.div
                      className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow"
                      animate={{ left: formData.dailyReportEnabled ? '22px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {formData.dailyReportEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 sm:p-4 bg-gray-50 rounded-xl">
                      <label className="flex items-center gap-2 sm:gap-3">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                        <span className="font-medium text-gray-700 text-sm sm:text-base">Report Time</span>
                      </label>
                      <select
                        value={formData.reportTime}
                        onChange={(e) => updateField('reportTime', e.target.value)}
                        className="w-full mt-2 px-3 sm:px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-orange-400 focus:outline-none text-sm sm:text-base"
                      >
                        <option value="08:00">8:00 AM - Morning</option>
                        <option value="12:00">12:00 PM - Noon</option>
                        <option value="18:00">6:00 PM - Evening</option>
                        <option value="20:00">8:00 PM - Night</option>
                      </select>
                    </div>
                  </motion.div>
                )}

                <div className="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                  Reports will be sent to: <strong className="break-all">{formData.parentEmail}</strong>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 text-red-600 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm mt-3 sm:mt-4"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          {currentStep > 1 && (
            <motion.button
              type="button"
              onClick={prevStep}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors text-sm sm:text-base"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Back</span>
            </motion.button>
          )}

          {currentStep < 4 ? (
            <motion.button
              type="button"
              onClick={nextStep}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium shadow-lg hover:shadow-xl transition-shadow text-sm sm:text-base"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-medium shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 text-sm sm:text-base"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="hidden xs:inline">Registering...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden xs:inline">Complete</span>
                  <span className="xs:hidden">Done</span>
                </>
              )}
            </motion.button>
          )}
        </div>

        {/* Skip for now */}
        <button
          type="button"
          onClick={() => setCurrentView('chat')}
          className="w-full mt-3 sm:mt-4 text-xs sm:text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
