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

export type FoodAnalysis = {
  protein: string
  carbs: string
  spice: string
  gut_notes: string
  fiber_level: 'high' | 'moderate' | 'low'
  key_nutrients: string[]
  gut_cautions: string[]
  ibs_trigger_risk: 'low' | 'moderate' | 'high'
  kidney_notes: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { description } = await req.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description required' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `You are a gut health nutrition analyst specializing in post-giardia gut recovery and IgA nephropathy kidney protection.
Given a food description, map it to structured fields and provide gut-specific analysis.

PROTEIN options (pick the single closest match): Chicken, Fish, Eggs, Red Meat, Lentils/Dal, Tofu, None
CARBS options (pick the single closest match): White Rice, Bread, Pasta, Cooked Vegetables, Leafy Greens, Legumes/Beans, Oats, None
SPICE options (pick one): None, Mild, Medium, Hot, Very Hot

Return ONLY valid JSON, no markdown.`,
    })

    const result = await model.generateContent(`Analyze this food for gut health impact: "${description}"

Return JSON with exactly this structure:
{
  "protein": "<one of the protein options>",
  "carbs": "<one of the carbs options>",
  "spice": "<one of the spice options>",
  "gut_notes": "<2-3 sentence plain English summary of gut impact — fermentability, motility effects, inflammation potential>",
  "fiber_level": "<high|moderate|low>",
  "key_nutrients": ["<nutrient 1>", "<nutrient 2>"],
  "gut_cautions": ["<caution if any, else empty array>"],
  "ibs_trigger_risk": "<low|moderate|high>",
  "kidney_notes": "<one sentence on potassium/phosphorus/protein load relevant to IgA nephropathy>"
}`)

    const raw = result.response.text()

    let parsed: FoodAnalysis
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')
      parsed = JSON.parse(match[0])
    }

    // Validate against allowed values
    const PROTEINS = ['Chicken', 'Fish', 'Eggs', 'Red Meat', 'Lentils/Dal', 'Tofu', 'None']
    const CARBS = ['White Rice', 'Bread', 'Pasta', 'Cooked Vegetables', 'Leafy Greens', 'Legumes/Beans', 'Oats', 'None']
    const SPICES = ['None', 'Mild', 'Medium', 'Hot', 'Very Hot']

    if (!PROTEINS.includes(parsed.protein)) parsed.protein = 'None'
    if (!CARBS.includes(parsed.carbs)) parsed.carbs = 'None'
    if (!SPICES.includes(parsed.spice)) parsed.spice = 'None'

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Food analyze error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
