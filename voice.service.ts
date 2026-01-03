import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  isListening = signal(false);
  transcript = signal('');
  
  private recognition: any;
  private synthesis = window.speechSynthesis;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening.set(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            this.transcript.set(event.results[i][0].transcript);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isListening.set(false);
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
      };
    }
  }

  startListening() {
    this.transcript.set('');
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // Already started or error
        console.warn(e);
      }
    } else {
      alert('Speech recognition is not supported in this browser.');
    }
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speak(text: string) {
    if (!text) return;
    
    // Cancel current speech
    this.synthesis.cancel();

    // Strip markdown chars for smoother speech (basic)
    const cleanText = text.replace(/[*#`_]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Try to find a good voice
    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('en-US')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    this.synthesis.speak(utterance);
  }
}