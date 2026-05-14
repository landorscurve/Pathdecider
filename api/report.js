export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { career, state, status, notes, sections, name, email } = req.body;
  if (!career || !state) return res.status(400).json({ error: 'Career and state are required' });

  career = career.trim();
  state = state.trim();
  name = (name || 'Student').trim();
  email = (email || '').trim();
  sections = sections || ['career', 'ai', 'education', 'skills', 'action'];

  // Add contact to Brevo list
  console.log(`Report request: ${email} | ${career} in ${state}`);
  if (email && process.env.BREVO_API_KEY) {
    try {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
          email: email,
          updateEnabled: true,
          attributes: {
            FIRSTNAME: name || '',
            CAREER: career,
            STATE: state,
            STATUS: status || 'Student',
            SOURCE: 'PathDecider Report'
          },
          listIds: [2]
        })
      });
    } catch (brevoErr) {
      console.error('Brevo error:', brevoErr);
    }
  }

  const system = `You are the PathDecider Report Generator. Create a comprehensive personalized career report in JSON format using accurate labor market data from BLS, O*NET, NCES, and industry research through August 2025.

CRITICAL JSON RULES:
- Respond ONLY with a valid JSON object, nothing else
- No apostrophes, no contractions
- No markdown, no backticks
- Straight double quotes only

Return this exact structure with all sections populated accurately:

{
  "reportTitle": "PathDecider Career Report",
  "generatedDate": "May 2026",
  "person": {
    "name": "${name}",
    "status": "${status || 'Student'}",
    "career": "${career}",
    "state": "${state}"
  },
  "careerSection": {
    "title": "${career}",
    "stateSalaryMedian": "accurate median salary in ${state} from BLS data",
    "salaryEntry": "entry level salary in ${state}",
    "salaryTop": "top 10 percent salary in ${state}",
    "nationalMedian": "national median for comparison",
    "usWorkers": "total US employment",
    "jobGrowth": "BLS projected growth e.g. +8%",
    "fieldAlignment": "percent working in related field e.g. 87%",
    "description": "2-3 sentences on this career in ${state}. Specific and honest. No apostrophes."
  },
  "aiSection": {
    "riskLevel": "low or medium or high",
    "riskScore": integer 0-100,
    "summary": "2 sentences on AI risk for this career. Specific tasks. No apostrophes.",
    "tasksAtRisk": ["specific task being automated", "specific task", "specific task"],
    "tasksSafe": ["specific human task that remains", "specific task", "specific task"],
    "timeline": "estimated years to significant displacement e.g. 10+ years or 3-5 years"
  },
  "educationSection": {
    "recommendedPath": "name of the best value education path for this career in ${state}",
    "recommendedCost": "total cost range for recommended path in ${state}",
    "recommendedTime": "time to complete",
    "reasoning": "2 sentences explaining why this is the best path. Specific numbers. No apostrophes.",
    "breakeven": "estimated years to break even on education cost given ${state} salary",
    "paths": [
      {"name": "Community College", "cost": "total cost range in ${state}", "time": "duration", "qualifies": "yes or no or partial"},
      {"name": "Public University (in-state)", "cost": "total cost range in ${state}", "time": "4 years", "qualifies": "yes or no or partial"},
      {"name": "Private University", "cost": "total cost range", "time": "4 years", "qualifies": "yes or no or partial"},
      {"name": "Trade / Vocational School", "cost": "total cost range in ${state}", "time": "duration", "qualifies": "yes or no or partial"}
    ]
  },
  "skillsSection": {
    "topCertifications": [
      {"name": "Specific certification name", "cost": "free or cost", "time": "time to earn", "impact": "one sentence on why this matters. No apostrophes."},
      {"name": "Specific certification name", "cost": "free or cost", "time": "time to earn", "impact": "one sentence. No apostrophes."},
      {"name": "Specific certification name", "cost": "free or cost", "time": "time to earn", "impact": "one sentence. No apostrophes."}
    ],
    "topSkills": ["specific skill 1", "specific skill 2", "specific skill 3", "specific skill 4"]
  },
  "actionSection": {
    "day30": [
      "specific action step tailored to ${status || 'student'} pursuing ${career} in ${state}",
      "specific action step",
      "specific action step"
    ],
    "day60": [
      "specific action step",
      "specific action step"
    ],
    "day90": [
      "specific action step",
      "specific action step"
    ],
    "proTip": "one specific insider tip for ${career} in ${state} that most people do not know. No apostrophes."
  }
}`;

  const userMsg = `Generate a complete career report for: ${career} in ${state}.
Person: ${name}, ${status || 'student'}.
${notes ? 'Additional context: ' + notes : ''}
Include these sections: ${sections.join(', ')}.
Be specific with salary numbers, education costs in ${state}, and actionable steps for someone pursuing ${career}.`;

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
    return res.status(500).json({ error: 'We had trouble generating your report. Please try again.' });
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
