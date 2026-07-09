#!/usr/bin/env python3
"""
SoterAI IDE Guard Demo Video Generator
Generates MP4 from frames and audio using OpenCV
"""

import os
import sys
import wave
from pathlib import Path
import subprocess

def generate_video_with_opencv(frames_dir, voiceover_path, output_path):
    """Generate video using OpenCV from frames"""
    try:
        import cv2
        import numpy as np
        
        print("Using OpenCV for video generation...")
        
        # Get frame files
        frame_files = sorted([f for f in frames_dir.glob("frame_*.png")])
        if not frame_files:
            print("ERROR: No frames found")
            return False
        
        print(f"Found {len(frame_files)} frames")
        
        # Read first frame to get dimensions
        first_frame = cv2.imread(str(frame_files[0]))
        height, width = first_frame.shape[:2]
        
        # Create video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(str(output_path), fourcc, 30.0, (width, height))
        
        # Write frames
        for i, frame_file in enumerate(frame_files):
            frame = cv2.imread(str(frame_file))
            out.write(frame)
            if (i + 1) % 100 == 0:
                print(f"  Wrote {i + 1}/{len(frame_files)} frames")
        
        out.release()
        print("Video written successfully")
        
        # Now merge with audio using ffmpeg
        temp_video = output_path.parent / "temp_video.mp4"
        os.rename(str(output_path), str(temp_video))
        
        cmd = [
            "ffmpeg",
            "-i", str(temp_video),
            "-i", str(voiceover_path),
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            "-y",
            str(output_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        os.remove(str(temp_video))
        
        if result.returncode == 0:
            return True
        else:
            print(f"ffmpeg error: {result.stderr[:200]}")
            return False
            
    except ImportError:
        print("OpenCV not available")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def generate_video_with_imageio(frames_dir, voiceover_path, output_path):
    """Generate video using imageio"""
    try:
        import imageio
        import numpy as np
        
        print("Using imageio for video generation...")
        
        # Get frame files
        frame_files = sorted([f for f in frames_dir.glob("frame_*.png")])
        if not frame_files:
            print("ERROR: No frames found")
            return False
        
        print(f"Found {len(frame_files)} frames")
        
        # Read frames
        frames = []
        for i, frame_file in enumerate(frame_files):
            frame = imageio.imread(str(frame_file))
            frames.append(frame)
            if (i + 1) % 100 == 0:
                print(f"  Loaded {i + 1}/{len(frame_files)} frames")
        
        # Write video
        print("Writing video...")
        imageio.mimwrite(str(output_path), frames, fps=30, codec='libx264')
        
        # Merge with audio
        temp_video = output_path.parent / "temp_video.mp4"
        os.rename(str(output_path), str(temp_video))
        
        cmd = [
            "ffmpeg",
            "-i", str(temp_video),
            "-i", str(voiceover_path),
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            "-y",
            str(output_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        os.remove(str(temp_video))
        
        if result.returncode == 0:
            return True
        else:
            print(f"ffmpeg error: {result.stderr[:200]}")
            return False
            
    except ImportError:
        print("imageio not available")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    output_dir = Path(r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\demo\output")
    voiceover_path = output_dir / "voiceover.wav"
    final_video_path = output_dir / "soterai-ide-guard-marketplace-demo.mp4"
    frames_dir = output_dir / "frames"
    
    print("=== SoterAI IDE Guard Demo Video Encoder ===\n")
    
    if not frames_dir.exists():
        print(f"ERROR: Frames directory not found at {frames_dir}")
        return 1
    
    if not voiceover_path.exists():
        print(f"ERROR: Voiceover not found at {voiceover_path}")
        return 1
    
    print(f"Frames: {frames_dir}")
    print(f"Voiceover: {voiceover_path}")
    print(f"Output: {final_video_path}\n")
    
    # Try OpenCV first
    if generate_video_with_opencv(frames_dir, voiceover_path, final_video_path):
        if final_video_path.exists():
            size_mb = final_video_path.stat().st_size / (1024 * 1024)
            print(f"\nSUCCESS: Video created ({size_mb:.2f} MB)")
            return 0
    
    # Try imageio
    if generate_video_with_imageio(frames_dir, voiceover_path, final_video_path):
        if final_video_path.exists():
            size_mb = final_video_path.stat().st_size / (1024 * 1024)
            print(f"\nSUCCESS: Video created ({size_mb:.2f} MB)")
            return 0
    
    print("\nERROR: Could not generate video")
    print("Frames are saved at:", frames_dir)
    return 1

if __name__ == "__main__":
    sys.exit(main())
