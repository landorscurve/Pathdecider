export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { resumeText, major, year, career, time } = req.body;

  const hasResume = resumeText && resumeText.trim().length > 50;
  const hasMajor = major && major.trim().length > 0;

  if (!hasResume && !hasMajor) {
    return res.status(400).json({ error: 'Either resume text or a major is required.' });
  }

  const timeContext = time
    ? { '2': '1 to 2 hours per week', '5': '3 to 5 hours per week', '10': '5 to 10 hours per week', '15': '10 or more hours per week' }[time] || ''
    : '';

  const system = `You are the PathDecider Student Pivot Advisor. You help college students figure out what skills, certifications, and actions to add on top of their existing degree to stay relevant in an AI economy. You have deep knowledge of labor market trends, AI displacement risk, in-demand certifications, and career pivoting strategies through August 2025.

CRITICAL JSON RULES:
- Respond ONLY with a valid JSON object, nothing else
- Do NOT use contractions or apostrophes anywhere
- Use only straight double quotes
- No markdown, no backticks, no preamble, no trailing text

Return this exact structure:

{
  "name": "detected or inferred student label e.g. Psychology Junior or Marketing Senior",
  "majorDetected": "the primary academic major or field you detected",
  "yearDetected": "freshman or sophomore or junior or senior or grad or unknown",
  "context": "2 sentences describing this student profile and why their pivot matters right now. No apostrophes.",
  "aiRisk": "low or medium or high",
  "riskTitle": "short headline about their AI exposure e.g. Medium exposure — augment, do not avoid",
  "riskBody": "2 sentences on how AI will affect this major or background specifically. Specific, not generic. No apostrophes.",
  "resumeInsights": ${hasResume ? `"2-3 sentences on what stands out from their resume — specific strengths, gaps, or leverage points. No apostrophes."` : `null`},
  "topSkills": [
    {
      "name": "Skill name",
      "why": "Why this skill specifically for this student profile. 1-2 sentences. No apostrophes.",
      "time": "e.g. 4-6 weeks",
      "cost": "e.g. Free or $200",
      "badge": "now",
      "badgeLabel": "Start now"
    }
  ],
  "otherSkills": [
    {
      "name": "Skill name",
      "why": "Why this skill. 1-2 sentences. No apostrophes.",
      "time": "e.g. 2-3 months",
      "cost": "e.g. $50-$200",
      "badge": "soon",
      "badgeLabel": "Next semester"
    }
  ],
  "certs": [
    {
      "name": "Certification name",
      "detail": "1-2 sentences on why this cert, who offers it, and how long it takes. No apostrophes.",
      "color": "#D85A30 or #1D9E75 or #BA7517"
    }
  ],
  "timeline": {
    "now": ["Action item 1", "Action item 2"],
    "semester": ["Action item 1", "Action item 2"],
    "year": ["Action item 1", "Action item 2"],
    "senior": ["Action item 1", "Action item 2"]
  },
  "timelineLabels": {
    "now": "This month",
    "semester": "This semester",
    "year": "Next 12 months",
    "senior": "Senior year or beyond"
  }
}

GUIDELINES:
- topSkills: 2-3 highest-impact skills, badge must be "now", badgeLabel "Start now"
- otherSkills: 2-4 additional skills; badge is "soon" (badgeLabel "Next semester") or "later" (badgeLabel "Plan ahead")
- certs: 2-4 certifications, specific and real, not generic
- timeline.now: 2-3 immediate actions this month
- timeline.semester: 2-3 actions for this semester
- timeline.year: 2-3 actions for the next 12 months
- timeline.senior: 2-3 actions for senior year or post-grad
- If resume is provided, make recommendations specific to their actual experience, not just their major
- Vary cert colors: use coral (#D85A30) for top priority, green (#1D9E75) for career-changers, amber (#BA7517) for technical boosts`;

  const userMsg = hasResume
    ? `Here is the student resume text:\n\n${resumeText.slice(0, 8000)}\n\n${major ? `They have also told us their major is: ${major}` : ''}\n${year ? `Year in school: ${year}` : ''}\n${career ? `Career interest: ${career}` : ''}\n${timeContext ? `Available time per week: ${timeContext}` : ''}\n\nBuild a personalized pivot plan based on their actual resume.`
    : `Major: ${major}\n${year ? `Year in school: ${year}` : ''}\n${career ? `Career interest: ${career}` : ''}\n${timeContext ? `Available time per week: ${timeContext}` : ''}\n\nBuild a pivot plan for this student.`;

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
    console.error('Pivot API error:', err);
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
