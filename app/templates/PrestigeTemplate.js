// PrestigeTemplate.js — Tinted contact band | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function PrestigeTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const color = accentColor || '#5b4fcf';
  const bandBg = color + '18';
  const fontFamily = font || 'Garamond, "Times New Roman", serif';

  const px = (n) => `${Math.round(n * sp)}px`;

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.1',
      color: '#1a1a1a',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    nb: { padding: `${px(30)} ${px(52)} 0` },
    name: {
      fontFamily,
      fontSize: '22pt',
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(2),
      lineHeight: '1.1',
    },
    tl: {
      fontFamily,
      fontSize: `${base + 1}pt`,
      letterSpacing: '1px',
      color: color,
      fontStyle: 'italic',
      marginBottom: px(10),
      lineHeight: '1.1',
    },
    band: {
      background: bandBg,
      borderTop: `2px solid ${color}`,
      borderBottom: `1px solid ${color}33`,
      padding: `${px(6)} ${px(52)}`,
      fontSize: `${base}pt`,
      color: '#444',
      display: 'flex',
      gap: px(20),
      flexWrap: 'wrap',
      lineHeight: '1.1',
      fontFamily,
    },
    body: { padding: `${px(14)} ${px(52)} ${px(36)}` },
    section: { marginTop: px(14) },
    sh: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(2),
      marginTop: '0',
      lineHeight: '1.1',
    },
    rule: { border: 'none', borderBottom: `1px solid ${color}`, margin: `0 0 ${px(5)}` },
    entry: { marginBottom: px(10) },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontFamily, fontWeight: '700', fontSize: `${base}pt`, lineHeight: '1.1' },
    dt: { fontFamily, fontSize: `${base}pt`, color: '#666', fontStyle: 'italic', lineHeight: '1.1' },
    co: { fontFamily, fontSize: `${base}pt`, color: '#555', fontStyle: 'italic', marginBottom: px(2), lineHeight: '1.1' },
    li: { fontFamily, margin: `${px(1)} 0`, fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.1' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `${px(2)} 0`, lineHeight: '1.1' },
    bodyText: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `0 0 ${px(2)}`, lineHeight: '1.1' },
  };

  const contactParts = [
    resumeData.location,
    resumeData.phone,
    resumeData.email,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  const titleLine = resumeData.experience?.[0]?.title || 'Professional';

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.nb}>
        <div style={s.name}>{resumeData.fullName}</div>
        <div style={s.tl}>{titleLine}</div>
      </div>
      <div style={s.band}>
        {contactParts.map((p, i) => <span key={i}>{p}</span>)}
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* Summary */}
        {resumeData.summary && !resumeData.hideSummary && (
          <div style={s.section}>
            <div style={s.sh}>Professional Summary</div>
            <hr style={s.rule} />
            <p style={s.bodyText}>{resumeData.summary}</p>
          </div>
        )}

        {/* Experience */}
        {resumeData.experience?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Experience</div>
            <hr style={s.rule} />
            {resumeData.experience.map((job, i) => (
              <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
                <div style={s.row}>
                  <span style={s.jt}>{job.title}</span>
                  <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
                </div>
                <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
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
            <hr style={s.rule} />
            {resumeData.education.map((ed, i) => (
              <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
                <div style={s.row}>
                  <span style={s.jt}>{ed.school}</span>
                  <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
                </div>
                <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
                {ed.lines?.map((l, k) => <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.1' }}>{l}</div>)}
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {Object.keys(skills).length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Skills</div>
            <hr style={s.rule} />
            {Object.entries(skills).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: px(3) }}>
                {Object.keys(skills).length > 1
                  ? <><span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt`, color: color }}>{cat}: </span>
                      <span style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{items.join(' • ')}</span></>
                  : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{items.join(' • ')}</span>
                }
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {resumeData.certifications?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Certifications</div>
            <hr style={s.rule} />
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
            <hr style={s.rule} />
            {resumeData.volunteer.map((v, i) => (
              <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
                <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {resumeData.projects?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Projects</div>
            <hr style={s.rule} />
            {resumeData.projects.map((p, i) => (
              <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` — ${p.link}` : ''}</div>
                <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Additional Information</div>
          <hr style={s.rule} />
          {resumeData.additionalInfo.map((item, i) => (
            <div key={i} style={i < resumeData.additionalInfo.length - 1 ? { marginBottom: px(3) } : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.1', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
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
            <hr style={s.rule} />
            <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
              {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}