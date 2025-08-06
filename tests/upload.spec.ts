import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.beforeEach(async ({ page }) => {
  // Create a dummy audio file for testing
  const testFile = path.join(__dirname, 'test-audio.mp3');
  if (!fs.existsSync(testFile)) {
    // Create a minimal MP3 file (just header bytes to make it valid)
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 frame header
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    fs.writeFileSync(testFile, mp3Header);
  }
});

test('upload shows files in UI', async ({ page }) => {
  await page.goto('/');
  
  // Wait for app to load
  await expect(page.locator('text=tunes.fit')).toBeVisible();
  
  // Check initial state - no tracks
  const trackCount = await page.locator('.album-list-row').count();
  expect(trackCount).toBe(0);
  
  // Set up console logging to capture upload messages
  const messages: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') {
      messages.push(msg.text());
    }
  });
  
  // Upload a file
  const fileInput = page.locator('input[type="file"]');
  const testFile = path.join(__dirname, 'test-audio.mp3');
  
  await fileInput.setInputFiles(testFile);
  
  // Wait a bit for processing
  await page.waitForTimeout(2000);
  
  // Check console messages
  console.log('Console messages:', messages);
  
  // Check if tracks appear in UI
  await page.waitForSelector('.album-list-row', { timeout: 5000 });
  const newTrackCount = await page.locator('.album-list-row').count();
  expect(newTrackCount).toBe(1);
  
  // Check if track name is visible
  await expect(page.locator('.album-list-row .album-list-name')).toContainText('test-audio.mp3');
});

test('upload progress shows during processing', async ({ page }) => {
  await page.goto('/');
  
  const testFile = path.join(__dirname, 'test-audio.mp3');
  const fileInput = page.locator('input[type="file"]');
  
  await fileInput.setInputFiles(testFile);
  
  // Check if progress bar appears
  await expect(page.locator('.upload-progress')).toBeVisible();
  
  // Wait for completion
  await page.waitForTimeout(2000);
  
  // Progress bar should be gone
  await expect(page.locator('.upload-progress')).not.toBeVisible();
});