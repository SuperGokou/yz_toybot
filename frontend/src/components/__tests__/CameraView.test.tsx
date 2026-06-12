import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { CameraView } from '../CameraView';

describe('CameraView', () => {
  it('renders a video element and a start button when inactive', () => {
    render(
      <CameraView
        active={false}
        videoRef={createRef<HTMLVideoElement>()}
        onStart={() => {}}
        onStop={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: /开启摄像头/ })
    ).toBeInTheDocument();
  });

  it('renders a stop button when active', () => {
    render(
      <CameraView
        active
        videoRef={createRef<HTMLVideoElement>()}
        onStart={() => {}}
        onStop={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: /关闭摄像头/ })
    ).toBeInTheDocument();
  });

  it('calls onStart when the start button is clicked', async () => {
    const onStart = vi.fn();
    render(
      <CameraView
        active={false}
        videoRef={createRef<HTMLVideoElement>()}
        onStart={onStart}
        onStop={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /开启摄像头/ }));
    expect(onStart).toHaveBeenCalled();
  });

  it('calls onStop when the stop button is clicked', async () => {
    const onStop = vi.fn();
    render(
      <CameraView
        active
        videoRef={createRef<HTMLVideoElement>()}
        onStart={() => {}}
        onStop={onStop}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /关闭摄像头/ }));
    expect(onStop).toHaveBeenCalled();
  });
});
