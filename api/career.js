export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { career, state } = req.body;
  if (!career) return res.status(400).json({ error: 'Career is required' });
  career = career.trim();
  state = (state || '').trim();

  const isNational = !state || state === 'National (US Average)';
  const stateContext = isNational
    ? 'Provide national US average salary and job market data.'
    : `The user wants data specific to ${state}. Provide ${state}-specific salary figures from BLS state occupational employment data where available. Note how ${state} compares to the national average. Include the top 2-3 metro areas in ${state} where this career is most in demand. Include a cost of living note for ${state}.`;

  const system = `You are the PathDecider Career Data Engine. Analyze any career, job title, or occupation — even informal, misspelled, or highly specific terms like "regenerative farmer", "live sound engineer", or "Python developer". Interpret it as the closest real occupation and respond with accurate labor market data from your knowledge of BLS, O*NET, Brookings, and industry research through August 2025.

${stateContext}

CRITICAL JSON RULES:
- Respond ONLY with a valid JSON object, nothing else
- Do NOT use contractions: write "do not" not "don't"
- Do NOT use apostrophes anywhere in response text
- Use only straight double quotes for JSON strings
- No markdown, no backticks, no preamble

{
  "career": "clean specific career name",
  "state": "${isNational ? 'National US Average' : state}",
  "pathType": "college or trade or both or license",
  "pathTypeLabel": "human-readable label e.g. Trade / apprenticeship or College degree required",
  "description": "2-3 sentences on what the work actually involves day to day. No apostrophes.",
  "usWorkers": "approximate US total e.g. 404,800",
  "stateWorkers": "${isNational ? 'omit this field' : 'approximate number employed in ' + state}",
  "jobGrowth": "BLS projected growth e.g. +8% or -3%",
  "growthNote": "brief context e.g. projected 2022-32, faster than average",
  "salaryEntry": "entry level salary${isNational ? '' : ' in ' + state} e.g. $38,000",
  "salaryMedian": "median salary${isNational ? '' : ' in ' + state} e.g. $61,590",
  "salaryTop": "top 10 percent salary${isNational ? '' : ' in ' + state} e.g. $98,000",
  "salaryChartEntry": integer thousands e.g. 38,
  "salaryChartMedian": integer thousands e.g. 62,
  "salaryChartTop": integer thousands e.g. 98,
  "nationalMedian": "${isNational ? 'same as salaryMedian' : 'national median for comparison e.g. $61,590'}",
  "costOfLivingNote": "${isNational ? 'omit this field' : 'one sentence on cost of living in ' + state + ' vs national average. No apostrophes.'}",
  "topMetros": ${isNational ? '["Top US metro 1", "Top US metro 2", "Top US metro 3"]' : '["Top metro in ' + state + ' 1", "metro 2", "metro 3"]'},
  "topMetrosNote": "${isNational ? 'one sentence on top US metros for this career' : 'one sentence on where in ' + state + ' this career is strongest. No apostrophes.'}",
  "fieldAlignment": integer 0-100,
  "fieldAlignmentNote": "one sentence. No apostrophes.",
  "entryPaths": [
    {"pct": "65%", "label": "Path name", "note": "specific detail", "color": "#1D9E75"},
    {"pct": "25%", "label": "Path name", "note": "specific detail", "color": "#378ADD"},
    {"pct": "10%", "label": "Path name", "note": "specific detail", "color": "#7F77DD"}
  ],
  "aiRisk": "low or medium or high",
  "aiTitle": "one sentence risk summary. No apostrophes.",
  "aiBody": "2-3 sentences on what is automating and what is not. No apostrophes.",
  "displacementScore": integer 0-100,
  "historicalSpeed": integer 0-100,
  "currentAISpeed": integer 0-100,
  "adaptationDifficulty": integer 0-100,
  "tasksAtRisk": ["specific task", "specific task", "specific task", "specific task"],
  "tasksSurvive": ["specific human task", "specific task", "specific task"],
  "masterOrOperator": "Master or Operator or Both",
  "masterOrOperatorNote": "one sentence. No apostrophes.",
  "relatedCareers": ["Related career 1", "Related career 2", "Related career 3"]
}

Use #1D9E75 green for trade/vocational paths, #185FA5 blue for college paths, #378ADD light blue, #7F77DD purple, #D85A30 coral, #888780 gray for entry path colors.`;

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
        messages: [{ role: 'user', content: `Look up career data for: ${career}${isNational ? '' : ' in ' + state}` }]
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
    return res.status(500).json({ error: 'We had trouble looking up that career. Please try again.' });
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
