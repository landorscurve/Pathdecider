export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { field, state } = req.body;
  if (!field || !state) return res.status(400).json({ error: 'Field and state are required' });
  field = field.trim();
  state = state.trim();

  const system = `You are the PathDecider College vs. Trade Comparison Engine. For a given career field and state, find the best college degree path AND the best trade/vocational path and compare them side by side with accurate data from BLS, NCES, and industry research through August 2025.

If a field only has one valid path (e.g. nursing requires college, plumbing requires trade), still show both but note which does not apply.

CRITICAL JSON RULES:
- Respond ONLY with a valid JSON object
- No apostrophes, no contractions
- Straight double quotes only
- No markdown or backticks

{
  "field": "clean field name",
  "state": "${state}",
  "collegePath": {
    "title": "specific degree e.g. Bachelor of Science in Nursing",
    "duration": "e.g. 4 years",
    "totalCost": "total cost in ${state} e.g. $60,000 - $90,000",
    "tuitionPerYear": "annual tuition in ${state}",
    "credential": "e.g. Bachelor of Science in Nursing (BSN)",
    "accreditation": "relevant accrediting body e.g. ACEN for nursing",
    "salaryAtEntry": "starting salary in ${state}",
    "salaryAt5Years": "salary after 5 years in ${state}",
    "salaryMedian": "median salary in ${state}",
    "hiringRate": "percent of graduates who find field-related work within 6 months e.g. 78%",
    "pros": ["pro 1", "pro 2", "pro 3"],
    "cons": ["con 1", "con 2", "con 3"],
    "bestSchoolsInState": ["specific school name in ${state}", "specific school name"],
    "aiRisk": "low or medium or high",
    "aiNote": "one sentence on AI risk for the college path version of this career. No apostrophes.",
    "debtAtGraduation": "estimated debt if financing e.g. $35,000 - $55,000",
    "breakevenYears": integer years to break even on education cost
  },
  "tradePath": {
    "title": "specific program e.g. Licensed Practical Nurse (LPN) program or Welding Certificate",
    "duration": "e.g. 12 months or 2 years",
    "totalCost": "total cost in ${state} e.g. $8,000 - $18,000",
    "tuitionPerYear": "annual tuition or total if under 1 year",
    "credential": "e.g. LPN license or Welding Certificate or Journeyman license",
    "accreditation": "relevant licensing body e.g. NCLEX for LPN or AWS for welding",
    "salaryAtEntry": "starting salary in ${state}",
    "salaryAt5Years": "salary after 5 years in ${state}",
    "salaryMedian": "median salary in ${state}",
    "hiringRate": "percent who find field-related work within 6 months",
    "pros": ["pro 1", "pro 2", "pro 3"],
    "cons": ["con 1", "con 2", "con 3"],
    "bestSchoolsInState": ["specific trade school or program in ${state}", "specific program"],
    "aiRisk": "low or medium or high",
    "aiNote": "one sentence on AI risk for the trade path version of this career. No apostrophes.",
    "debtAtGraduation": "estimated debt if financing",
    "breakevenYears": integer years to break even on education cost
  },
  "verdict": {
    "winner": "college or trade or depends",
    "winnerNote": "2-3 sentences explaining which path wins for this specific field in ${state} and why. Be specific with numbers. No apostrophes.",
    "salaryGapAt5Years": "salary difference between college and trade path at 5 years e.g. +$12,000 for college",
    "costGap": "total cost difference e.g. college costs $52,000 more",
    "timeGap": "time difference e.g. college takes 3 years longer",
    "bestForWhoCollege": "one sentence on who should choose college. No apostrophes.",
    "bestForWhoTrade": "one sentence on who should choose trade. No apostrophes."
  },
  "hybridOption": {
    "exists": true or false,
    "description": "If a hybrid path exists (e.g. start at community college then transfer, or get trade cert first then upgrade to degree), describe it in 2 sentences. No apostrophes. If no hybrid exists, set exists to false and leave description empty."
  },
  "relatedComparisons": ["Related field 1", "Related field 2", "Related field 3"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: `Compare college vs trade path for: ${field} in ${state}` }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const result = robustParse(txt);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'We had trouble running this comparison. Please try again.' });
  }
}

function robustParse(txt) {
  let clean = txt.replace(/```json|```/g, '').trim();
  const s = clean.indexOf('{');
  const e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON found');
  let j = clean.slice(s, e + 1);
  j = j.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  j = j.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  j = j.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  try { return JSON.parse(j); } catch (e1) {}
  try {
    let fixed = j.replace(/"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
      return '"' + inner.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ') + '"';
    });
    return JSON.parse(fixed);
  } catch (e2) {}
  try {
    let fixed = j.replace(/:\s*"([^"\\]*)"/g, (match, inner) => {
      return ': "' + inner.replace(/[\x00-\x1F\x7F]/g, '').replace(/'/g, '').trim() + '"';
    });
    return JSON.parse(fixed);
  } catch (e3) { throw new Error('Parse failed'); }
}
