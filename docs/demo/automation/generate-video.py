#!/usr/bin/env python3
"""
SoterAI IDE Guard Demo Video Generator
Generates MP4 from voiceover and captions using PIL and subprocess
"""

import os
import sys
import subprocess
import wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def get_audio_duration(wav_path):
    """Get duration of WAV file in seconds"""
    try:
        with wave.open(str(wav_path), 'rb') as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            return frames / rate
    except Exception as e:
        print(f"Error reading WAV: {e}")
        return 60  # Default to 60 seconds

def parse_srt(srt_path):
    """Parse SRT captions file"""
    captions = []
    try:
        with open(srt_path, 'r', encoding='utf-8') as f:
            content = f.read()
            blocks = content.strip().split('\n\n')
            for block in blocks:
                lines = block.strip().split('\n')
                if len(lines) >= 3:
                    time_range = lines[1]
                    text = '\n'.join(lines[2:])
                    start, end = time_range.split(' --> ')
                    captions.append({
                        'start': time_to_seconds(start),
                        'end': time_to_seconds(end),
                        'text': text
                    })
    except Exception as e:
        print(f"Error parsing SRT: {e}")
    return captions

def time_to_seconds(time_str):
    """Convert HH:MM:SS,mmm to seconds"""
    try:
        parts = time_str.strip().split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2].replace(',', '.'))
        return hours * 3600 + minutes * 60 + seconds
    except:
        return 0

def create_frame(width, height, caption_text=""):
    """Create a single frame image"""
    img = Image.new('RGB', (width, height), color=(30, 30, 30))
    draw = ImageDraw.Draw(img)
    
    # Try to use a nice font, fall back to default
    try:
        title_font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 60)
        caption_font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 40)
    except:
        title_font = ImageFont.load_default()
        caption_font = ImageFont.load_default()
    
    # Draw title
    title = "SoterAI IDE Guard"
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (width - title_width) // 2
    draw.text((title_x, 100), title, fill=(255, 255, 255), font=title_font)
    
    # Draw subtitle
    subtitle = "Local-First AI Security for Developers"
    subtitle_bbox = draw.textbbox((0, 0), subtitle, font=caption_font)
    subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
    subtitle_x = (width - subtitle_width) // 2
    draw.text((subtitle_x, 200), subtitle, fill=(100, 200, 255), font=caption_font)
    
    # Draw caption at bottom
    if caption_text:
        # Wrap text
        lines = []
        words = caption_text.split()
        current_line = []
        for word in words:
            current_line.append(word)
            line_text = ' '.join(current_line)
            bbox = draw.textbbox((0, 0), line_text, font=caption_font)
            if bbox[2] - bbox[0] > width - 100:
                if len(current_line) > 1:
                    current_line.pop()
                    lines.append(' '.join(current_line))
                    current_line = [word]
                else:
                    lines.append(line_text)
                    current_line = []
        if current_line:
            lines.append(' '.join(current_line))
        
        # Draw caption lines
        y_pos = height - 150
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=caption_font)
            line_width = bbox[2] - bbox[0]
            x_pos = (width - line_width) // 2
            draw.text((x_pos, y_pos), line, fill=(255, 255, 255), font=caption_font)
            y_pos += 50
    
    return img

def generate_video_with_ffmpeg(frames_dir, voiceover_path, output_path, duration):
    """Generate video using ffmpeg from frames and audio"""
    try:
        # Create video from frames
        cmd = [
            "ffmpeg",
            "-framerate", "30",
            "-i", str(frames_dir / "frame_%06d.png"),
            "-i", str(voiceover_path),
            "-c:v", "libx264",
            "-preset", "medium",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            "-y",
            str(output_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            return True
        else:
            print(f"ffmpeg error: {result.stderr[:200]}")
            return False
    except FileNotFoundError:
        print("ffmpeg not found")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    output_dir = Path(r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\demo\output")
    voiceover_path = output_dir / "voiceover.wav"
    captions_path = output_dir / "captions.srt"
    final_video_path = output_dir / "soterai-ide-guard-marketplace-demo.mp4"
    frames_dir = output_dir / "frames"
    
    print("=== SoterAI IDE Guard Demo Video Generator ===\n")
    
    # Verify inputs
    if not voiceover_path.exists():
        print(f"ERROR: Voiceover not found at {voiceover_path}")
        return 1
    
    if not captions_path.exists():
        print(f"ERROR: Captions not found at {captions_path}")
        return 1
    
    print(f"[1/4] Voiceover: {voiceover_path}")
    print(f"[1/4] Captions: {captions_path}\n")
    
    # Get audio duration
    duration = get_audio_duration(voiceover_path)
    print(f"[2/4] Audio duration: {duration:.1f} seconds")
    
    # Parse captions
    captions = parse_srt(captions_path)
    print(f"[2/4] Captions parsed: {len(captions)} blocks\n")
    
    # Create frames directory
    frames_dir.mkdir(exist_ok=True)
    print(f"[3/4] Generating frames...")
    
    # Generate frames
    frame_count = int(duration * 30)  # 30 fps
    width, height = 1920, 1080
    
    for frame_num in range(frame_count):
        current_time = frame_num / 30.0
        
        # Find current caption
        current_caption = ""
        for caption in captions:
            if caption['start'] <= current_time <= caption['end']:
                current_caption = caption['text']
                break
        
        # Create frame
        img = create_frame(width, height, current_caption)
        frame_path = frames_dir / f"frame_{frame_num:06d}.png"
        img.save(frame_path)
        
        if (frame_num + 1) % 30 == 0:
            print(f"  Generated {frame_num + 1}/{frame_count} frames ({(frame_num + 1) / frame_count * 100:.0f}%)")
    
    print(f"[3/4] Frames generated: {frame_count} frames\n")
    
    # Generate video
    print(f"[4/4] Generating video...")
    if generate_video_with_ffmpeg(frames_dir, voiceover_path, final_video_path, duration):
        if final_video_path.exists():
            size_mb = final_video_path.stat().st_size / (1024 * 1024)
            print(f"SUCCESS: Video created ({size_mb:.2f} MB)")
            print(f"Output: {final_video_path}\n")
            
            # Cleanup frames
            import shutil
            shutil.rmtree(frames_dir, ignore_errors=True)
            
            return 0
    
    print("ERROR: Could not generate video with ffmpeg")
    print("Frames saved to:", frames_dir)
    return 1

if __name__ == "__main__":
    sys.exit(main())
