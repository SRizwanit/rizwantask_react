import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE: GitHub Pages প্রজেক্ট-সাইটে "/রিপো-নাম/" (GitHub Action নিজে সেট করে); কাস্টম ডোমেইন/লোকাল ডেভে "/"
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 }
});
