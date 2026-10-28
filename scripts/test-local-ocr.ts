import fs from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { suggestFields } from '../src/utils/ocrFields.js';

const worker = await createWorker(['eng','sin','tam'], 1, { langPath: path.resolve('ocr-models'), gzip: false, cacheMethod: 'none' });
try {
  const result = await worker.recognize(fs.readFileSync(process.argv[2] || path.resolve('tests/fixtures/english-fields.png')));
  console.log('confidence',result.data.confidence);
  console.log('text',result.data.text);
  console.log('fields',suggestFields(result.data.text,result.data.confidence));
} finally { await worker.terminate(); }
