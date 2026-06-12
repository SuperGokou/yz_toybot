import { RefObject } from 'react';
import { Camera, CameraOff } from 'lucide-react';

interface CameraViewProps {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement>;
  onStart: () => void;
  onStop: () => void;
}

export function CameraView({ active, videoRef, onStart, onStop }: CameraViewProps) {
  return (
    <div className="relative w-full max-w-sm">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full aspect-video rounded-2xl bg-black object-cover shadow-lg"
      />

      <button
        type="button"
        onClick={active ? onStop : onStart}
        aria-label={active ? '关闭摄像头' : '开启摄像头'}
        className="
          absolute bottom-3 left-1/2 -translate-x-1/2
          flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
          bg-white/90 backdrop-blur-sm text-gray-700 shadow-lg
          hover:bg-white transition-all duration-200
        "
      >
        {active ? (
          <>
            <CameraOff className="w-4 h-4" />
            关闭摄像头
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            开启摄像头
          </>
        )}
      </button>
    </div>
  );
}
