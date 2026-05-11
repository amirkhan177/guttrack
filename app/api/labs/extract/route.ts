export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
    if (!allowedTypes.some(t => mimeType.includes(t.split('/')[1]))) {
      return NextResponse.json({ error: 'Unsupported file type. Upload PDF or image.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Build content block based on file type
    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } }
      | { type: 'text'; text: string }

    let fileBlock: ContentBlock

    const isPdf = mimeType.includes('pdf')

    if (isPdf) {
      fileBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      }
    } else {
      // Normalize image mime type to Claude-supported types
      let imgMime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
      if (mimeType.includes('png')) imgMime = 'image/png'
      else if (mimeType.includes('webp')) imgMime = 'image/webp'

      fileBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imgMime,
          data: base64,
        },
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: 'Extract all lab test results from this report. Remember: ignore all patient PII. Return only the JSON object.',
            },
          ],
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''

    let parsed: { labs: ExtractedLab[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in Claude response')
      parsed = JSON.parse(match[0])
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
