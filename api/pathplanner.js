export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { field, homeState, targetState, budget, pathType } = req.body;
  if (!field || !targetState) return res.status(400).json({ error: 'Field and state are required' });

  field = field.trim();
  homeState = (homeState || '').trim();
  targetState = targetState.trim();
  budget = (budget || '').trim();
  pathType = (pathType || 'any').trim();

  const isComparison = homeState && homeState !== targetState && homeState !== 'Not sure yet';
  const budgetContext = budget ? `The student has a budget of approximately ${budget} for their total education.` : '';
  const pathContext = pathType !== 'any' ? `The student is specifically interested in the ${pathType} path.` : 'The student is open to both college and trade paths.';

  const system = `You are the PathDecider Path Planner. You help students and parents compare education costs and career outcomes by state. Respond with accurate data from your knowledge of BLS, NCES, College Board, and industry research through August 2025.

CRITICAL JSON RULES:
- Respond ONLY with a valid JSON object, nothing else
- Do NOT use contractions or apostrophes
- Use only straight double quotes
- No markdown, no backticks, no preamble

Return this exact structure:

{
  "field": "clean field or career name",
  "targetState": "${targetState}",
  "homeState": "${homeState || 'not specified'}",
  "careerTitle": "the most common job title for this field e.g. Registered Nurse",
  "stateMedianSalary": "median salary for this career in ${targetState} e.g. $72,000",
  "nationalMedianSalary": "national median salary e.g. $61,590",
  "salaryContext": "one sentence comparing ${targetState} salary to national average and cost of living. No apostrophes.",
  "jobGrowth": "projected growth for this career in ${targetState} or nationally e.g. +12%",
  "jobDemand": "high or medium or low",
  "jobDemandNote": "one sentence on job demand in ${targetState} for this field. No apostrophes.",
  "topHiringCities": ["City 1 in ${targetState}", "City 2", "City 3"],
  "tuitionTiers": [
    {
      "tier": "Community College",
      "avgCost": "average total cost for this path in ${targetState} e.g. $8,000 - $16,000",
      "timeToComplete": "e.g. 2 years",
      "credential": "what credential they earn e.g. Associate degree or certificate",
      "hiresFor": "does this tier qualify for the target career? yes, no, or partial",
      "hiresNote": "one sentence on employability from this tier for this field. No apostrophes.",
      "bestFor": "one sentence on who this tier is best for. No apostrophes.",
      "exampleSchools": ["Example school 1 in ${targetState}", "Example school 2"]
    },
    {
      "tier": "Public University (in-state)",
      "avgCost": "average total cost in ${targetState} e.g. $40,000 - $80,000",
      "timeToComplete": "e.g. 4 years",
      "credential": "e.g. Bachelor degree",
      "hiresFor": "yes, no, or partial",
      "hiresNote": "one sentence. No apostrophes.",
      "bestFor": "one sentence. No apostrophes.",
      "exampleSchools": ["Example school 1 in ${targetState}", "Example school 2"]
    },
    {
      "tier": "Public University (out-of-state)",
      "avgCost": "average total cost e.g. $100,000 - $160,000",
      "timeToComplete": "e.g. 4 years",
      "credential": "e.g. Bachelor degree",
      "hiresFor": "yes, no, or partial",
      "hiresNote": "one sentence. No apostrophes.",
      "bestFor": "one sentence. No apostrophes.",
      "exampleSchools": ["Example school in another state that feeds into ${targetState} market"]
    },
    {
      "tier": "Private University",
      "avgCost": "average total cost e.g. $160,000 - $260,000",
      "timeToComplete": "e.g. 4 years",
      "credential": "e.g. Bachelor degree",
      "hiresFor": "yes, no, or partial",
      "hiresNote": "one sentence. No apostrophes.",
      "bestFor": "one sentence. No apostrophes.",
      "exampleSchools": ["Example private school 1", "Example private school 2"]
    },
    {
      "tier": "Trade / Vocational School",
      "avgCost": "average total cost e.g. $5,000 - $20,000",
      "timeToComplete": "e.g. 6 months - 2 years",
      "credential": "e.g. Certificate or license",
      "hiresFor": "yes, no, or partial",
      "hiresNote": "one sentence. No apostrophes.",
      "bestFor": "one sentence. No apostrophes.",
      "exampleSchools": ["Example trade school or program in ${targetState}"]
    }
  ],
  "recommendation": {
    "bestTier": "the tier name that offers the best ROI for this field and state",
    "reasoning": "2-3 sentences explaining why this tier is the best value for this specific field in ${targetState}. Be specific about cost, salary, and time to breakeven. No apostrophes.",
    "breakeven": "estimated years to break even on education cost given ${targetState} salary e.g. 4-6 years",
    "watchOut": "one sentence on the biggest risk or mistake to avoid for this path. No apostrophes.",
    "proTip": "one specific, actionable tip for this field in ${targetState} that most students do not know. No apostrophes."
  },
  ${isComparison ? `"stateComparison": {
    "homeState": "${homeState}",
    "homeStateMedianSalary": "median salary for this career in ${homeState}",
    "homeStateAvgInStateTuition": "average public in-state tuition total cost in ${homeState}",
    "salaryDifference": "dollar difference between ${targetState} and ${homeState} e.g. +$8,000 or -$5,000",
    "costDifference": "tuition cost difference e.g. +$12,000 more expensive or $8,000 cheaper in ${targetState}",
    "verdict": "stay or move or depends",
    "verdictNote": "2 sentences on whether it makes financial sense to go to school in ${targetState} vs ${homeState} for this field. Be specific with numbers. No apostrophes."
  },` : ''}
  "aiRisk": "low or medium or high for this career",
  "aiRiskNote": "one sentence on AI displacement risk for this career. No apostrophes.",
  "relatedFields": ["Related field 1", "Related field 2", "Related field 3"]
}`;

  try {
    const userMsg = `Plan the education path for someone who wants to pursue ${field} in ${targetState}.${homeState && homeState !== 'Not sure yet' ? ' Their home state is ' + homeState + '.' : ''} ${budgetContext} ${pathContext}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2500,
        system,
        messages: [{ role: 'user', content: userMsg }]
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
    return res.status(500).json({ error: 'We had trouble building your plan. Please try again.' });
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
