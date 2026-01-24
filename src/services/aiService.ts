import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiData } from '../types/api';

let genAI: GoogleGenerativeAI | null = null;

export function initializeAI(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey);
}

export async function analyzeCode(codeSnippet: string): Promise<ApiData | null> {
  if (!genAI) {
    throw new Error('Layanan AI belum diinisialisasi. Silakan atur API key Gemini Anda di pengaturan.');
  }

  try {
    // Menggunakan model Gemini 2.5 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `Anda adalah Expert Keamanan & Dokumentasi API yang menganalisis Next.js API route handlers.

INSTRUKSI KRITIS - BAHASA OUTPUT: BAHASA INDONESIA

SEMUA teks yang Anda hasilkan HARUS dalam BAHASA INDONESIA yang baik dan benar, termasuk:
- summary (ringkasan)
- description (deskripsi)
- parameter descriptions (deskripsi parameter)
- issue titles (judul masalah)
- issue descriptions (deskripsi masalah)
- recommendations (rekomendasi)

JANGAN gunakan kata-kata Inggris kecuali istilah teknis (contoh: GET, POST, JSON, API).
JANGAN terjemahkan istilah teknis seperti "GET", "POST", "query", "body", "header", "path".

Contoh BENAR:
- "Mengambil daftar workspace berdasarkan kepemilikan pengguna"
- "Judul workspace baru. Tidak boleh kosong."
- "Tidak ada validasi autentikasi"
- "Parameter query untuk filter data"

Contoh SALAH (JANGAN SEPERTI INI):
- "Retrieves a list of workspaces..."
- "The title of the new workspace..."
- "Missing authentication validation"
- "Query parameter for filtering data"

Analisis kode route Next.js yang diberikan dan ekstrak SEMUA HTTP methods dalam file.

PENTING: Satu file route.ts bisa mengekspor multiple functions seperti GET, POST, PUT, DELETE, PATCH, dll.
Anda HARUS menganalisis dan mengembalikan informasi untuk SETIAP method yang ditemukan dalam file.

Untuk setiap method, ekstrak:
1. Nama HTTP method (GET, POST, PUT, DELETE, PATCH, dll.)
2. Ringkasan dan deskripsi tentang apa yang dilakukan method tersebut (DALAM BAHASA INDONESIA)
3. Request parameters spesifik untuk method tersebut (query, body, headers, path params)
4. Struktur response dan schemas untuk method tersebut

Juga analisis seluruh file untuk:
5. Endpoint path (kesimpulan dari struktur file Next.js yang umum)
6. Masalah keamanan (autentikasi, otorisasi, validasi input, risiko SQL injection, XSS, dll) - JELASKAN DALAM BAHASA INDONESIA
7. Masalah skalabilitas (query N+1, paginasi yang hilang, algoritma tidak efisien, dll) - JELASKAN DALAM BAHASA INDONESIA

KRITIS: Kembalikan HANYA JSON yang valid dengan TANPA markdown, TANPA blok kode, TANPA backticks.
JSON harus sesuai dengan struktur EKSAK ini:
{
  "endpoint": "/api/users",
  "endpoints": [
    {
      "method": "GET",
      "summary": "Mengambil daftar semua pengguna",
      "description": "Endpoint ini mengambil semua data pengguna dari database. Hasil dapat difilter menggunakan parameter query.",
      "params": [
        {
          "name": "scope",
          "type": "string",
          "required": false,
          "description": "Menentukan cakupan visibilitas workspace yang akan diambil. Defaultnya adalah own. Nilai yang mungkin: own (workspace pengguna), public (semua workspace publik), all (workspace pengguna dan publik), manage (semua workspace, memerlukan peran Dosen atau Admin).",
          "location": "query"
        }
      ],
      "responseSchema": [
        {
          "status": 200,
          "contentType": "application/json",
          "schema": "{ \\"users\\": \\"array\\" }",
          "example": "{ \\"users\\": [{ \\"id\\": 1, \\"name\\": \\"John\\" }] }"
        }
      ]
    }
  ],
  "issues": [
    {
      "severity": "warning",
      "title": "Tidak ada rate limiting",
      "description": "Endpoint ini tidak mengimplementasikan rate limiting, yang dapat menyebabkan penyalahgunaan dan beban server yang berlebihan.",
      "recommendation": "Tambahkan middleware rate limiting untuk membatasi jumlah permintaan per pengguna per menit. Pertimbangkan untuk menggunakan library seperti express-rate-limit."
    }
  ]
}

INGAT: Semua "summary", "description", "params[].description", "issues[].title", "issues[].description", dan "issues[].recommendation" HARUS dalam BAHASA INDONESIA!

Kembalikan HANYA objek JSON, tidak ada yang lain.`;

    const prompt = `${systemPrompt}\n\nKode untuk dianalisis:\n\`\`\`typescript\n${codeSnippet}\n\`\`\``;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Bersihkan response - hapus blok kode markdown jika ada
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Parse JSON
    const apiData: ApiData = JSON.parse(cleanedText);
    apiData.timestamp = new Date().toISOString();

    return apiData;
  } catch (error) {
    console.error('Error menganalisis kode dengan AI:', error);
    if (error instanceof Error) {
      throw new Error(`Analisis AI gagal: ${error.message}`);
    }
    throw error;
  }
}