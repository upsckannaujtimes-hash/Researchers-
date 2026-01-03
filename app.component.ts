import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, ResearchResult } from './services/gemini.service';
import { VoiceService } from './services/voice.service';

interface Message {
  role: 'user' | 'model';
  content: string;
  sources?: { title: string; url: string }[];
  attachment?: { name: string; mimeType: string; data: string };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  geminiService = inject(GeminiService);
  voiceService = inject(VoiceService);

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('promptInput') promptInput!: ElementRef;

  messages = signal<Message[]>([]);
  userInput = '';
  isLoading = signal(false);
  currentStatus = signal<string>('');
  useDeepThinking = signal(false);
  selectedFile = signal<{ name: string; mimeType: string; data: string } | null>(null);

  constructor() {
    // Effect to update input from voice transcript
    effect(() => {
      const transcript = this.voiceService.transcript();
      if (transcript) {
        this.userInput = transcript;
      }
    });

    // Effect to scroll to bottom on new messages
    effect(() => {
      if (this.messages().length) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  toggleThinking() {
    this.useDeepThinking.update(v => !v);
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  handleFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64Data = e.target.result.split(',')[1];
      this.selectedFile.set({
        name: file.name,
        mimeType: file.type,
        data: base64Data
      });
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset input
  }

  removeFile() {
    this.selectedFile.set(null);
  }

  setInput(text: string) {
    this.userInput = text;
    // Focus the textarea
    if (this.promptInput) this.promptInput.nativeElement.focus();
  }

  toggleVoice() {
    if (this.voiceService.isListening()) {
      this.voiceService.stopListening();
    } else {
      this.voiceService.startListening();
    }
  }

  handleEnter(event: Event) {
    event.preventDefault();
    this.sendMessage();
  }

  async sendMessage() {
    if ((!this.userInput.trim() && !this.selectedFile()) || this.isLoading()) return;

    const userText = this.userInput;
    const file = this.selectedFile();
    
    // Add User Message
    this.messages.update(msgs => [...msgs, {
      role: 'user',
      content: userText,
      attachment: file ? file : undefined
    }]);

    this.userInput = '';
    this.selectedFile.set(null);
    this.isLoading.set(true);
    this.currentStatus.set('Analyzing request...');

    try {
      // Prepare files for service
      const filesToSend = file ? [{ mimeType: file.mimeType, data: file.data }] : [];
      
      this.currentStatus.set('Searching & Reasoning...');
      const result = await this.geminiService.performResearch(userText, filesToSend, this.useDeepThinking());
      
      this.messages.update(msgs => [...msgs, {
        role: 'model',
        content: result.text,
        sources: result.sources
      }]);

    } catch (error) {
      this.messages.update(msgs => [...msgs, {
        role: 'model',
        content: 'Sorry, I encountered an error during research. Please try again.',
        sources: []
      }]);
    } finally {
      this.isLoading.set(false);
      this.currentStatus.set('');
    }
  }

  scrollToBottom() {
    if (this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }
  }
}