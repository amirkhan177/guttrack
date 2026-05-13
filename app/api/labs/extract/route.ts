export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
}

export type ExtractedLab = {
  name: string
  value: string
  unit: string
  status: 'Normal' | 'Elevated' | 'Low' | 'Unknown'
  reference_range: string
  date: string | null
}

const SYSTEM_PROMPT = `You are a medical lab report parser. Your job is to extract structured lab test results from lab reports.

CRITICAL PRIVACY RULES — YOU MUST FOLLOW THESE WITHOUT EXCEPTION:
- IGNORE and DO NOT output: patient name, date of birth, age, address, phone number, email, MRN/patient ID, doctor name, clinic name, account number, SSN, insurance ID
- Only extract the actual lab test measurements and their values
- If you see any PII, treat it as invisible

Your task: extract every lab test result and return structured JSON.

Return ONLY valid JSON, no markdown, no explanation. Schema:
{
  "labs": [
    {
      "name": "test name (e.g. Creatinine, eGFR, Hemoglobin)",
      "value": "numeric or text value as string",
      "unit": "unit of measurement (e.g. mg/dL, g/dL, %)",
      "status": "Normal | Elevated | Low | Unknown",
      "reference_range": "reference range if visible (e.g. 0.6-1.2) else empty string",
      "date": "collection date as YYYY-MM-DD if visible in report else null"
    }
  ]
}

Determine status from:
- Explicit H/L/HIGH/LOW/ABNORMAL flags in the report
- Whether the value is outside the reference range
- If unclear: "Unknown"`

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]

    const mimeType = file.type || 'application/octet-stream'
    // Map MIME type for Gemini
    let finalMime = mimeType
    if (mimeType === 'image/jpg') finalMime = 'image/jpeg'

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    })

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: finalMime,
        },
      },
      {
        text: 'Extract all lab test results from this report. Remember: ignore all patient PII. Return only the JSON object.',
      },
    ])

    const raw = result.response.text()

    let parsed: { labs: ExtractedLab[] }
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : raw)
    } catch {
      throw new Error('No JSON in response')
    }

    if (!Array.isArray(parsed.labs)) {
      return NextResponse.json({ error: 'Could not parse lab results from document' }, { status: 422 })
    }

    // Enforce status values
    const validStatuses = ['Normal', 'Elevated', 'Low', 'Unknown']
    const labs = parsed.labs.map(lab => ({
      ...lab,
      status: validStatuses.includes(lab.status) ? lab.status : 'Unknown',
    }))

    return NextResponse.json({ labs, count: labs.length })
  } catch (err) {
    console.error('Lab extract error:', err)
    return NextResponse.json({ error: 'Extraction failed. Check file and try again.' }, { status: 500 })
  }
}
