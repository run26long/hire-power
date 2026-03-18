// SharpTemplate.js — Bold sans-serif | Free tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function SharpTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const fontFamily = font || 'Calibri, "Trebuchet MS", Arial, sans-serif';

  const px = (n) => `${Math.round(n * sp)}px`;
  const heavyWeight = (font && font.includes('Arial')) ? '700' : '800';

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.3',
      color: '#111',
      padding: `${px(36)} ${px(52)}`,
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    name: {
      fontFamily,
      fontSize: '22pt',
      fontWeight: heavyWeight,
      letterSpacing: '0.5px',
      padding: '0',
      marginBottom: px(2),
      lineHeight: '1.3',
      color: '#111',
      textAlign: 'left',
    },
    contact: {
      fontFamily,
      fontSize: `${base}pt`,
      color: '#444',
      display: 'flex',
      gap: px(12),
      flexWrap: 'wrap',
      marginBottom: px(4),
      lineHeight: '1.3',
    },
    hdrRule: {
      border: 'none',
      borderBottom: '1px solid #111',
      margin: `0 0 ${px(8)} 0`,
    },
    section: {
      marginTop: px(14),
    },
    sh: {
      fontFamily,
      fontSize: `${base+2}pt`,
      fontWeight: heavyWeight,
      letterSpacing: '2px',
      textTransform: 'uppercase',
      borderBottom: '1.5px solid #111',
      paddingBottom: px(2),
      marginBottom: px(5),
      marginTop: '0',
      color: '#111',
      lineHeight: '1.3',
    },
    entry: { marginBottom: px(10) },
    jobTitle: { fontFamily, fontWeight: heavyWeight, fontSize: `${base}pt`, lineHeight: '1.3', color: '#111' },
    jobMeta: { fontFamily, fontSize: `${base}pt`, color: '#555', marginBottom: px(2), lineHeight: '1.3' },
    li: { fontFamily, margin: `${px(1)} 0`, fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.3' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#444', margin: `${px(2)} 0`, lineHeight: '1.3' },
    body: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `0 0 ${px(2)}`, lineHeight: '1.3' },
    eduTitle: { fontFamily, fontWeight: heavyWeight, fontSize: `${base}pt`, lineHeight: '1.3', color: '#111' },
    eduMeta: { fontFamily, fontSize: `${base}pt`, color: '#555', lineHeight: '1.3' },
  };

  const contactParts = [
    resumeData.phone,
    resumeData.email,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.name}>{resumeData.fullName}</div>
      <hr style={s.hdrRule} />
      <div style={s.contact}>{contactParts.map((p, i) => <span key={i}>{p}{i < contactParts.length - 1 ? ' | ' : ''}</span>)}</div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div style={s.section}>
          <div style={s.sh}>{resumeData.sectionTitles?.summary || 'Professional Summary'}</div>
          <p style={s.body}>{resumeData.summary}</p>
        </div>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Experience</div>
          {resumeData.experience.map((job, i) => (
            <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
              <div style={s.jobTitle}>{job.title}</div>
              <div style={s.jobMeta}>
                {[job.company, job.location, formatDateRange(job.startDate, job.endDate, job.current, dateFormat)]
                  .filter(Boolean).join(' | ')}
              </div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <div style={{ marginTop: px(2) }}>
                  {job.bullets.map((b, k) => (
                    <div key={k} style={s.li}>
                      <span style={{ flexShrink: 0 }}>•</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Education</div>
          {resumeData.education.map((ed, i) => (
            <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
              <div style={s.eduTitle}>{ed.school}</div>
              <div style={s.eduMeta}>
                {[ed.degree && ed.field ? `${ed.degree}, ${ed.field}` : (ed.degree || ed.field), formatDate(ed.graduationDate, dateFormat)]
                  .filter(Boolean).join(' | ')}
              </div>
              {ed.lines?.map((l, k) => <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.3' }}>{l}</div>)}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {Object.keys(skills).length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Skills</div>
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: px(3) }}>
              {Object.keys(skills).length > 1
                ? <><span style={{ fontFamily, fontWeight: heavyWeight, fontSize: `${base}pt` }}>{cat}: </span>
                    <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span></>
                : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Certifications</div>
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={i < resumeData.certifications.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt` }}>
                <strong>{c.name}</strong>{c.details ? ` | ${c.details}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Volunteer Experience</div>
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '800', fontSize: `${base}pt` }}>{v.organization}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Projects</div>
          {resumeData.projects.map((p, i) => (
            <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '800', fontSize: `${base}pt` }}>{p.name}{p.link ? ` — ${p.link}` : ''}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Additional Information</div>
          {resumeData.additionalInfo.map((item, i) => (
            <div key={i} style={i < resumeData.additionalInfo.length - 1 ? { marginBottom: px(3) } : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.3', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <strong>{item.label}</strong>
                {item.detail && <span style={{ color: '#555' }}>| {item.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Languages</div>
          <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </div>
      )}
    </div>
  );
}