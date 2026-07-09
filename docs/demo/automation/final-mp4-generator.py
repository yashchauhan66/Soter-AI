#!/usr/bin/env python3
"""
SoterAI IDE Guard - Final MP4 Video Generator (Direct ffmpeg)
"""

import os
import sys
from pathlib import Path
import subprocess
import wave

def find_ffmpeg():
    """Find ffmpeg executable"""
    paths = [
        "ffmpeg",
        "C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe",
    ]
    
    for path in paths:
        try:
            result = subprocess.run([path, "-version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                return path
        except:
            pass
    
    # Try imageio_ffmpeg
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except:
        pass
    
    return None

def main():
    output_dir = Path("docs/demo/output")
    frames_dir = output_dir / "frames"
    voiceover_path = output_dir / "voiceover.wav"
    captions_path = output_dir / "captions.srt"
    final_video_path = output_dir / "soterai-ide-guard-marketplace-demo.mp4"
    
    print("=" * 70)
    print("SoterAI IDE Guard - Final MP4 Video Generator")
    print("=" * 70)
    print()
    
    # Verify inputs
    print("[1/3] Verifying assets...")
    if not voiceover_path.exists():
        print("ERROR: Voiceover not found")
        return 1
    if not captions_path.exists():
        print("ERROR: Captions not found")
        return 1
    if not frames_dir.exists():
        print("ERROR: Frames directory not found")
        return 1
    
    frame_files = sorted(list(frames_dir.glob("frame_*.png")))
    if not frame_files:
        print("ERROR: No frame files found")
        return 1
    
    print("[OK] Voiceover: " + voiceover_path.name)
    print("[OK] Captions: " + captions_path.name)
    print("[OK] Frames: " + str(len(frame_files)) + " PNG files")
    print()
    
    # Find ffmpeg
    print("[2/3] Locating ffmpeg...")
    ffmpeg_cmd = find_ffmpeg()
    if not ffmpeg_cmd:
        print("ERROR: ffmpeg not found")
        return 1
    print("[OK] Found ffmpeg: " + str(ffmpeg_cmd))
    print()
    
    # Generate MP4 directly from frame sequence with audio
    print("[3/3] Generating final MP4...")
    
    # Convert captions path for ffmpeg
    captions_for_ffmpeg = str(captions_path).replace("\\", "/")
    
    # Command 1: Try with burned captions
    cmd = [
        ffmpeg_cmd,
        "-y",
        "-framerate", "30",
        "-i", str(frames_dir / "frame_%06d.png"),
        "-i", str(voiceover_path),
        "-vf", "subtitles=" + captions_for_ffmpeg,
        "-c:v", "libx264",
        "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(final_video_path)
    ]
    
    print("  Attempting to merge with burned captions...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    
    if result.returncode != 0:
        print("  Subtitle filter failed, retrying without burned captions...")
        
        # Command 2: Without captions (will use external SRT)
        cmd = [
            ffmpeg_cmd,
            "-y",
            "-framerate", "30",
            "-i", str(frames_dir / "frame_%06d.png"),
            "-i", str(voiceover_path),
            "-c:v", "libx264",
            "-preset", "medium",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(final_video_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        
        if result.returncode != 0:
            print("ERROR: ffmpeg failed")
            print(result.stderr[:500])
            return 1
        
        print("  [OK] Video generated (captions as external SRT file)")
    else:
        print("  [OK] Video generated with burned captions")
    
    print()
    
    # Verify output
    print("=" * 70)
    print("VERIFICATION")
    print("=" * 70)
    print()
    
    if not final_video_path.exists():
        print("ERROR: Final MP4 not created")
        return 1
    
    file_size_mb = final_video_path.stat().st_size / (1024 * 1024)
    print("[OK] Final MP4 exists: " + final_video_path.name)
    print("[OK] File size: " + str(round(file_size_mb, 2)) + " MB")
    
    # Get video info
    try:
        ffprobe_cmd = str(ffmpeg_cmd).replace("ffmpeg", "ffprobe")
        result = subprocess.run(
            [ffprobe_cmd, "-v", "error", "-show_entries", "format=duration,size",
             "-of", "default=noprint_wrappers=1", str(final_video_path)],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            for line in lines:
                if "duration" in line:
                    duration_val = float(line.split("=")[1])
                    print("[OK] Duration: " + str(round(duration_val, 1)) + " seconds")
    except:
        pass
    
    print()
    print("=" * 70)
    print("SUCCESS - Final MP4 Ready for Marketplace")
    print("=" * 70)
    print()
    print("Output: " + str(final_video_path))
    print()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
