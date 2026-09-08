import { execFile } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(execFile);

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
      const { stdout } = await execPromise(process.env.PYTHON_BIN || (process.platform === 'win32' ? 'C:\\Windows\\py.exe' : 'python3'),
        [path.resolve(__dirname, '../../transcribe.py'), videoPath], { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true });
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
