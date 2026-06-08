import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export class TranscriptionService {
  /**
   * Transcribes a video file using faster-whisper.
   * Note: This requires python and faster-whisper to be installed on the system.
   * If they are not available, it currently returns a placeholder or throws.
   */
  static async transcribeVideo(videoPath: string): Promise<string> {
    try {
      // Execute our local transcribe.py script using the absolute path to the py launcher
      // to avoid PATH issues if the node server hasn't been restarted.
      const { stdout } = await execPromise(`C:\\Windows\\py.exe transcribe.py "${videoPath}"`);
      const transcript = stdout.trim();
      
      if (!transcript) {
        throw new Error("No transcript generated.");
      }
      
      return transcript;

    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe video');
    }
  }
}
