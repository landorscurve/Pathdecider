function resolveKey(input){const norm=input.toLowerCase().trim();if(PIVOT_DATA[norm])return norm;if(ALIASES[norm])return ALIASES[norm];for(const k of Object.keys(PIVOT_DATA)){if(norm.includes(k)||k.includes(norm))return k;}return null;}
function riskColor(risk){if(risk==='low')return'#085041';if(risk==='medium')return'#854F0B';return'#712B13';}
function buildPlan(){
  const majorVal=document.getElementById('major').value;
  const yearVal=document.getElementById('year-select').value;
  const careerVal=document.getElementById('career-input').value;
  const timeVal=document.getElementById('time-select').value;
  if(!majorVal.trim()){document.getElementById('major').focus();return;}
  const key=resolveKey(majorVal);
  const panel=document.getElementById('results-panel');
  if(!key){
    panel.innerHTML=`<div style="padding:1.5rem;background:var(--gray-50);border-radius:var(--radius-lg);text-align:center;"><p style="font-size:14px;font-weight:500;margin-bottom:.5rem;">No pre-built plan for "${majorVal}" yet.</p><p style="font-size:13px;color:var(--text-muted);">Try one of the majors in the quick-select above, or contact us to request your major be added.</p></div>`;
    panel.classList.add('show');
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
    return;
  }
  const d=PIVOT_DATA[key];
  const horizon=YEAR_HORIZON[yearVal]||YEAR_HORIZON['sophomore'];
  const timeNote=timeVal?{'2':'With 1–2 hours/week, focus on one skill at a time — certifications first.','5':'With 3–5 hours/week, you can run one cert and one skill track simultaneously.','10':'With 5–10 hours/week, you can complete a full certification in 6–8 weeks while building project experience.','15':'With 10+ hours/week, you can accelerate significantly — stack multiple credentials in a semester.'}[timeVal]:null;
  const topSkills=d.skills.filter(s=>s.priority);
  const otherSkills=d.skills.filter(s=>!s.priority);
  panel.innerHTML=`
    <div style="margin-bottom:1.5rem;">
      <p class="result-name">${d.label}${yearVal?' — '+document.getElementById('year-select').options[document.getElementById('year-select').selectedIndex].text:''}</p>
      <p class="result-context">${d.context}${careerVal?' You mentioned interest in <strong>'+careerVal+'</strong> — the recommendations below factor that in.':''}</p>
      ${timeNote?`<p style="font-size:12px;margin-top:.5rem;color:var(--text-muted);">${timeNote}</p>`:''}
    </div>
    <p class="section-lbl">Start here — highest impact skills</p>
    <div class="skills-grid">${topSkills.map(s=>`<div class="skill-card priority"><div class="skill-header"><p class="skill-name">${s.name}</p><span class="skill-badge badge-now">${s.badgeLabel}</span></div><p class="skill-why">${s.why}</p><div class="skill-meta"><p class="skill-meta-item">Time: <span>${s.time}</span></p><p class="skill-meta-item">Cost: <span>${s.cost}</span></p></div></div>`).join('')}</div>
    <p class="section-lbl">Build on it — additional skills</p>
    <div class="skills-grid">${otherSkills.map(s=>`<div class="skill-card"><div class="skill-header"><p class="skill-name">${s.name}</p><span class="skill-badge badge-${s.badge}">${s.badgeLabel}</span></div><p class="skill-why">${s.why}</p><div class="skill-meta"><p class="skill-meta-item">Time: <span>${s.time}</span></p><p class="skill-meta-item">Cost: <span>${s.cost}</span></p></div></div>`).join('')}</div>
    <p class="section-lbl">Certifications worth getting</p>
    <div class="certs-list">${d.certs.map(c=>`<div class="cert-row"><div class="cert-dot" style="background:${c.color};margin-top:5px;"></div><div><p class="cert-name">${c.name}</p><p class="cert-detail">${c.detail}</p></div></div>`).join('')}</div>
    <p class="section-lbl">Your timeline</p>
    <div class="timeline">
      <div class="timeline-row"><p class="timeline-period">${horizon.now}</p><div class="timeline-items">${d.timeline.now.map(t=>`<div class="timeline-item">${t}</div>`).join('')}</div></div>
      <div class="timeline-row"><p class="timeline-period">${horizon.semester}</p><div class="timeline-items">${d.timeline.semester.map(t=>`<div class="timeline-item">${t}</div>`).join('')}</div></div>
      <div class="timeline-row"><p class="timeline-period">${horizon.year}</p><div class="timeline-items">${d.timeline.year.map(t=>`<div class="timeline-item">${t}</div>`).join('')}</div></div>
      <div class="timeline-row"><p class="timeline-period">${horizon.senior}</p><div class="timeline-items">${d.timeline.senior.map(t=>`<div class="timeline-item">${t}</div>`).join('')}</div></div>
    </div>
    <p class="section-lbl">AI & automation outlook</p>
    <div class="risk-block ${d.aiRisk}"><p class="risk-title" style="color:${riskColor(d.aiRisk)};">${d.riskTitle}</p><p class="risk-body">${d.riskBody}</p></div>
    <div class="divider"></div>
    <div class="cta-row">
      <div class="cta-text"><p>Want to see the full ROI on your degree?</p><p>Calculate your expected earnings vs. cost</p></div>
      <a href="degree-roi.html" class="cta-btn">Degree ROI Calculator →</a>
    </div>`;
  panel.classList.add('show');
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function quickFill(major){document.getElementById('major').value=major;}
